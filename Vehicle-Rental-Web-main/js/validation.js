/** Client-side validation for the contact form. */
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("contact-form");
    if (!form) return;

    const fields = {
        "full-name": { validate: (value) => value ? "" : "Name is required." },
        email: {
            validate: (value) => {
                if (!value) return "Email is required.";
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "" : "Enter a valid email address.";
            }
        },
        phone: {
            validate: (value) => {
                if (!value) return "Phone number is required.";
                return /^\d{10}$/.test(value) ? "" : "Phone must contain exactly 10 digits.";
            }
        },
        "vehicle-type": { validate: (value) => value ? "" : "Please select a vehicle." },
        message: { validate: (value) => value ? "" : "Message is required." }
    };
    const success = document.getElementById("form-success");

    const showError = (id, message) => {
        const input = document.getElementById(id);
        const error = document.getElementById(`${id}-error`);
        input.classList.toggle("is-invalid", Boolean(message));
        input.setAttribute("aria-invalid", String(Boolean(message)));
        error.textContent = message;
        return !message;
    };

    const validateField = (id) => showError(id, fields[id].validate(document.getElementById(id).value.trim()));

    Object.keys(fields).forEach((id) => {
        const input = document.getElementById(id);
        input.addEventListener("input", () => validateField(id));
        input.addEventListener("change", () => validateField(id));
        input.addEventListener("blur", () => validateField(id));
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        success.classList.remove("is-visible");

        const valid = Object.keys(fields).map(validateField).every(Boolean);
        if (!valid) {
            form.querySelector(".is-invalid")?.focus();
            return;
        }

        form.reset();
        success.textContent = "✓ Message sent successfully! We'll be in touch shortly.";
        success.classList.add("is-visible");
    });
});
