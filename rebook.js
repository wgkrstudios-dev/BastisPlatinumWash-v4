/**
 * Basti's Platinum Car Wash - Secure Rebooking Portal Engine
 * Standalone client-side router and booking validation controller.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Utilize native URLSearchParams API to parse the active browser URL query string
    const urlParams = new URLSearchParams(window.location.search);
    const targetBookingId = urlParams.get('booking_id');

    // Strict validation check: immediately halt execution if targetBookingId is null, undefined, or empty
    if (!targetBookingId) {
        showLinkError();
        return;
    }

    console.log("Secure Rebooking Session Initialized for Booking ID:", targetBookingId);

    // Asynchronously fetch details from Supabase with silent error handling for security
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('customer_name, customer_email, customer_phone, vehicle_type, booking_status, booking_date_time')
            .eq('id', targetBookingId)
            .single();

        if (error) {
            throw error;
        }

        // Store retrieved data in a constant variables and verify flow
        const bookingData = data;
        console.log("Successfully retrieved booking data:", bookingData);

        // Inject securely retrieved values into HTML form inputs
        document.getElementById('rebook-name').value = bookingData.customer_name || '';
        document.getElementById('rebook-phone').value = bookingData.customer_phone || '';
        document.getElementById('rebook-email').value = bookingData.customer_email || '';
        document.getElementById('rebook-car-size').value = bookingData.vehicle_type || '';

        // Reveal the prefilled form by removing the inline display: none style
        const rebookForm = document.getElementById('rebook-form');
        if (rebookForm) {
            rebookForm.style.display = 'block';
        }
    } catch (err) {
        Sentry.captureException(err);
        // Fail silently to protect database architecture schema from malicious probing
        const errorContainer = document.getElementById('error-container');
        if (errorContainer) {
            errorContainer.innerHTML = '';
            const errorCard = document.createElement('div');
            errorCard.className = 'error-card';
            Object.assign(errorCard.style, {
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '16px',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(12px)',
                webkitBackdropFilter: 'blur(12px)',
                marginTop: '2.5rem',
                fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
                animation: 'fadeIn 0.4s ease-out'
            });
            errorCard.innerHTML = `
                <div style="font-size: 3rem; margin-bottom: 1.25rem; display: flex; justify-content: center; align-items: center; color: #f87171;">
                    <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </div>
                <h2 style="font-size: 1.3rem; font-weight: 700; color: #ffffff; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em;">Link Invalid or Expired</h2>
                <p style="font-size: 0.9rem; color: #a3a3ac; line-height: 1.6; max-width: 320px; margin: 0 auto;">Unable to load booking details. Link may be invalid or expired.</p>
            `;
            errorContainer.appendChild(errorCard);
        }
    }
});

/**
 * Dynamically renders a premium glassmorphic error card if the session link is invalid.
 */
function showLinkError() {
    const errorContainer = document.getElementById('error-container');
    if (!errorContainer) return;

    // Clear any previous elements in the container
    errorContainer.innerHTML = '';

    const errorCard = document.createElement('div');
    errorCard.className = 'error-card';

    // Apply premium glassmorphic styling aligned with the global dark theme design tokens
    Object.assign(errorCard.style, {
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '16px',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(12px)',
        webkitBackdropFilter: 'blur(12px)',
        marginTop: '2.5rem',
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
        animation: 'fadeIn 0.4s ease-out'
    });

    errorCard.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 1.25rem; display: flex; justify-content: center; align-items: center; color: #f87171;">
            <!-- Alert Triangle Icon -->
            <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
        </div>
        <h2 style="font-size: 1.3rem; font-weight: 700; color: #ffffff; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em;">Link Invalid or Expired</h2>
        <p style="font-size: 0.9rem; color: #a3a3ac; line-height: 1.6; max-width: 320px; margin: 0 auto;">This rebooking link is invalid, expired, or corrupted. Please check your source link or contact customer support for assistance.</p>
    `;

    errorContainer.appendChild(errorCard);
}

// Availability tracking blocks scoped outside form handlers
let confirmedBlocks = [];
let bufferBlocks = [];

// Date input change handler to load day conflicts
document.getElementById('rebook-date')?.addEventListener('change', async (event) => {
    const selectedDate = event.target.value;
    if (!selectedDate) return;

    confirmedBlocks = [];
    bufferBlocks = [];

    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('booking_date_time')
            .like('booking_date_time', `${selectedDate}%`)
            .eq('booking_status', 'confirmed');

        if (error) throw error;

        if (data) {
            data.forEach(booking => {
                if (booking.booking_date_time) {
                    const dateObj = new Date(booking.booking_date_time);
                    const timeHHMM = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                    confirmedBlocks.push(timeHHMM);

                    // Calculate mathematical buffer string (exactly 60 minutes/1 hour later)
                    const [hours, minutes] = timeHHMM.split(':').map(Number);
                    const bufferHour = (hours + 1) % 24;
                    const bufferTimeStr = `${String(bufferHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                    bufferBlocks.push(bufferTimeStr);
                }
            });
        }
    } catch (err) {
        Sentry.captureException(err);
        console.error("Availability check failed:", err);
    }
});

// Rebooking Form submission and client-side validation logic
document.getElementById('rebook-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedDate = document.getElementById('rebook-date').value;
    const selectedTime = document.getElementById('rebook-time').value;

    if (!selectedDate || !selectedTime) {
        showValidationFeedback("Please select a date and time.", "error");
        return;
    }

    // Validation 1: Check if the combined date and time is in the past
    const combinedDateTime = new Date(`${selectedDate}T${selectedTime}`);
    const now = new Date();
    if (combinedDateTime < now) {
        showValidationFeedback("Error: Cannot book a time slot in the past.", "error");
        return;
    }

    // Validation 2: Check if target time falls within confirmed or buffer slots
    const formattedSelectedTime = selectedTime.slice(0, 5);
    if (confirmedBlocks.includes(formattedSelectedTime) || bufferBlocks.includes(formattedSelectedTime)) {
        showValidationFeedback("Error: Selected time overlaps with an existing appointment or travel buffer window.", "error");
        return;
    }

    // CRITICAL TIMEZONE FIX: Isolate the raw input values into plain text strings to prevent raw JS Date offset shifting
    const formattedDateString = selectedDate;
    const formattedTimeString = formattedSelectedTime;

    // Get the target booking ID from url params (retrieve it query search parameters)
    const urlParams = new URLSearchParams(window.location.search);
    const targetBookingId = urlParams.get('booking_id');

    const submitBtn = document.getElementById('btn-confirm-rebook');

    try {
        if (submitBtn) submitBtn.disabled = true;

        const { error } = await supabase
            .from('bookings')
            .update({
                booking_date_time: new Date(`${formattedDateString}T${formattedTimeString}`).toISOString(),
                booking_status: 'pending'
            })
            .eq('id', targetBookingId);

        if (error) throw error;

        showValidationFeedback("Booking successfully updated! Your new time slot is pending confirmation.", "success");
        if (submitBtn) {
            submitBtn.style.opacity = '0.5';
            submitBtn.style.cursor = 'not-allowed';
        }
    } catch (err) {
        Sentry.captureException(err);
        console.error("Update failed:", err);
        showValidationFeedback("Network error: Could not complete transaction. Please check your connection and try again.", "error");
        if (submitBtn) submitBtn.disabled = false;
    }
});

/**
 * Renders a validation status alert card below the form for immediate premium user feedback.
 */
function showValidationFeedback(message, type = 'error') {
    const errorContainer = document.getElementById('error-container');
    if (!errorContainer) return;

    errorContainer.innerHTML = '';

    const card = document.createElement('div');
    card.className = `feedback-card ${type}-feedback`;
    
    Object.assign(card.style, {
        background: type === 'error' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(74, 222, 128, 0.08)',
        border: type === 'error' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(74, 222, 128, 0.3)',
        borderRadius: '16px',
        padding: '1.5rem',
        textAlign: 'center',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(12px)',
        webkitBackdropFilter: 'blur(12px)',
        marginTop: '1.5rem',
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
        color: '#ffffff',
        animation: 'fadeIn 0.3s ease-out'
    });

    card.innerHTML = `
        <div style="font-size: 2rem; margin-bottom: 0.75rem; color: ${type === 'error' ? '#f87171' : '#4ade80'};">
            ${type === 'error' ? '⚠️' : '✓'}
        </div>
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">${type === 'error' ? 'Validation Alert' : 'Rebooked Successful'}</h3>
        <p style="font-size: 0.9rem; color: #a3a3ac; line-height: 1.5; margin: 0;">${message}</p>
    `;

    errorContainer.appendChild(card);
}
