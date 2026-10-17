/**
 * Authoritative Drivora Rental Pricing & Late-Fee Engine
 * Shared by Node.js serverless endpoints (CommonJS) and Browser Frontend (window.DrivoraPricing).
 *
 * Documented Policy Rules:
 * 1. Full Days: Minimum 1 rental day (24-hour blocks).
 * 2. Partial Days & Extra-Hour Rounding:
 *    - Scheduled extra hours beyond full 24h blocks are rounded UP to the nearest 1-hour interval.
 *    - Default extra-hour rate = Math.round(dailyPrice / 8) unless explicitly configured on the vehicle.
 *    - Extra-hour charges for a partial day are capped at 1 full daily rate so customers are never overcharged.
 * 3. Grace Period & Late-Return Fees:
 *    - 1-hour grace period applies after the agreed return timestamp.
 *    - Late fees begin only when actual return exceeds agreed return + 1 hour grace period.
 *    - Late hours never overlap with scheduled extra hours (scheduled hours are part of the agreed booking window;
 *      late hours are strictly post-agreed-return overruns minus the 1-hour grace period).
 * 4. Security Deposit:
 *    - Refundable security deposit is itemized separately and never mixed with rental revenue.
 * 5. Cancellation Rules:
 *    - Cancelled >= 24 hours before pickup: ₹0 cancellation fee (100% refund of any pre-paid amount).
 *    - Cancelled < 24 hours before pickup: 15% of 1-day rental rate (or 25% of rentalSubtotal when passed via calculateBookingBreakdown).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DrivoraPricing = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const GRACE_PERIOD_HOURS = 1;
  const LATE_CANCEL_RATE = 0.15;

  function parseDateInput(dateVal, timeVal = "10:00") {
    if (!dateVal) return null;
    const str = String(dateVal).trim();
    if (str.includes("T")) {
      return new Date(str);
    }
    return new Date(`${str}T${timeVal || "10:00"}:00`);
  }

  function calculatePricing({
    dailyPrice = 0,
    dailyRate = 0,
    extraHourRate = null,
    lateFeePerHour = null,
    securityDeposit = 5000,
    pickupDate,
    returnDate,
    pickupAt,
    returnAt,
    pickupTime = "10:00",
    returnTime = "10:00",
    actualReturnIso = null,
    actualReturnAt = null,
    discountAmount = 0
  } = {}) {
    const ratePerDay = Math.max(0, Number(dailyPrice || dailyRate) || 0);
    const hourlyExtraRate =
      extraHourRate !== null && extraHourRate !== undefined && Number(extraHourRate) > 0
        ? Number(extraHourRate)
        : Math.round(ratePerDay / 8);
    const hourlyLateRate =
      lateFeePerHour !== null && lateFeePerHour !== undefined && Number(lateFeePerHour) > 0
        ? Number(lateFeePerHour)
        : Math.round(ratePerDay / 6);
    const deposit = Math.max(0, Number(securityDeposit) || 0);
    const discount = Math.max(0, Number(discountAmount) || 0);

    const startInput = pickupAt || pickupDate;
    const endInput = returnAt || returnDate;
    const actualEndInput = actualReturnAt || actualReturnIso;

    if (!startInput || !endInput) {
      return {
        valid: false,
        days: 0,
        billableDays: 0,
        extraHours: 0,
        billableLateHours: 0,
        lateBillableHours: 0,
        gracePeriodHours: GRACE_PERIOD_HOURS,
        dailyPrice: ratePerDay,
        extraHourRate: hourlyExtraRate,
        lateFeePerHour: hourlyLateRate,
        baseRentalAmount: 0,
        baseAmount: 0,
        extraHourAmount: 0,
        extraHourCharges: 0,
        lateFeeAmount: 0,
        lateReturnFee: 0,
        discountAmount: discount,
        securityDeposit: deposit,
        rentalSubtotal: 0,
        totalPayableWithDeposit: 0,
        totalPayable: 0
      };
    }

    const start = parseDateInput(startInput, pickupTime);
    const end = parseDateInput(endInput, returnTime);
    const diffMs = end.getTime() - start.getTime();

    if (Number.isNaN(diffMs) || diffMs <= 0) {
      return {
        valid: false,
        error: "Return date/time must be after pickup date/time.",
        days: 0,
        billableDays: 0,
        extraHours: 0,
        billableLateHours: 0,
        lateBillableHours: 0,
        gracePeriodHours: GRACE_PERIOD_HOURS,
        dailyPrice: ratePerDay,
        extraHourRate: hourlyExtraRate,
        lateFeePerHour: hourlyLateRate,
        baseRentalAmount: 0,
        baseAmount: 0,
        extraHourAmount: 0,
        extraHourCharges: 0,
        lateFeeAmount: 0,
        lateReturnFee: 0,
        discountAmount: discount,
        securityDeposit: deposit,
        rentalSubtotal: 0,
        totalPayableWithDeposit: 0,
        totalPayable: 0
      };
    }

    const totalScheduledHours = Math.ceil(diffMs / 3600000);
    let days = Math.floor(totalScheduledHours / 24);
    let extraHours = totalScheduledHours % 24;

    if (days === 0) {
      days = 1;
      extraHours = 0;
    }

    // Cap partial-day extra-hour charge at 1 full day rate
    let extraHourAmount = extraHours * hourlyExtraRate;
    if (extraHourAmount > ratePerDay) {
      days += 1;
      extraHours = 0;
      extraHourAmount = 0;
    }

    const baseRentalAmount = days * ratePerDay;

    // Late-return fee calculation (strictly after agreed return + 1h grace period)
    let rawLateHours = 0;
    let billableLateHours = 0;
    let lateFeeAmount = 0;

    if (actualEndInput) {
      const actualEnd = parseDateInput(actualEndInput);
      const overrunMs = actualEnd.getTime() - end.getTime();
      if (!Number.isNaN(overrunMs) && overrunMs > GRACE_PERIOD_HOURS * 3600000) {
        rawLateHours = Math.ceil(overrunMs / 3600000);
        billableLateHours = rawLateHours;
        lateFeeAmount = billableLateHours * hourlyLateRate;
      }
    }

    const rentalSubtotal = Math.max(
      0,
      baseRentalAmount + extraHourAmount + lateFeeAmount - discount
    );
    const totalPayableWithDeposit = rentalSubtotal + deposit;

    return {
      valid: true,
      days,
      billableDays: days,
      extraHours,
      rawLateHours,
      billableLateHours,
      lateBillableHours: billableLateHours,
      gracePeriodHours: GRACE_PERIOD_HOURS,
      dailyPrice: ratePerDay,
      extraHourRate: hourlyExtraRate,
      lateFeePerHour: hourlyLateRate,
      baseRentalAmount,
      baseAmount: baseRentalAmount,
      extraHourAmount,
      extraHourCharges: extraHourAmount,
      lateFeeAmount,
      lateReturnFee: lateFeeAmount,
      discountAmount: discount,
      securityDeposit: deposit,
      rentalSubtotal,
      totalPayableWithDeposit,
      totalPayable: totalPayableWithDeposit,
      policySummary: {
        partialDayRule: "Extra hours rounded up to nearest 1h; capped at 1 full day rate.",
        gracePeriod: "1 hour free grace period on scheduled return time.",
        lateFeeRule: "Applies only if return exceeds 1-hour grace period; never overlaps scheduled extra hours.",
        cancellationRule: "Free cancellation >= 24h before pickup; 15% of 1-day rate within 24h."
      }
    };
  }

  function calculateCancellationFee({
    dailyPrice = 0,
    rentalSubtotal = 0,
    pickupDate,
    pickupAt,
    pickupTime = "10:00",
    cancelledAtIso = null,
    cancelledAt = null
  } = {}) {
    const startInput = pickupAt || pickupDate;
    const cancelInput = cancelledAt || cancelledAtIso;
    const baseVal = Math.max(0, Number(dailyPrice || rentalSubtotal) || 0);
    if (!startInput) return { fee: 0, cancellationFee: 0, reason: "No pickup date" };
    const pickup = parseDateInput(startInput, pickupTime);
    const now = cancelInput ? parseDateInput(cancelInput) : new Date();
    const hoursUntilPickup = (pickup.getTime() - now.getTime()) / 3600000;
    if (hoursUntilPickup >= 24) {
      return {
        fee: 0,
        cancellationFee: 0,
        hoursUntilPickup: Math.round(hoursUntilPickup),
        policyApplied: "Free cancellation (>= 24h before pickup)"
      };
    }
    const rateMultiplier = dailyPrice ? LATE_CANCEL_RATE : 0.25;
    const fee = Math.round(baseVal * rateMultiplier);
    return {
      fee,
      cancellationFee: fee,
      hoursUntilPickup: Math.round(hoursUntilPickup),
      policyApplied: "Late cancellation (< 24h before pickup)"
    };
  }

  return {
    GRACE_PERIOD_HOURS,
    LATE_CANCEL_RATE,
    calculatePricing,
    calculateBookingBreakdown: calculatePricing,
    calculateCancellationFee
  };
});
