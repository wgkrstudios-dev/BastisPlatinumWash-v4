/**
 * Basti's Platinum Car Wash - Booking Confirmation Engine
 * Handles URL parsing, parameter validation, and error UI feedback.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const statusContainer = document.getElementById('status-container');
    
    try {
        // Utilize the native URLSearchParams API to parse the active browser URL
        const urlParams = new URLSearchParams(window.location.search);
        const bookingId = urlParams.get('booking_id');
        
        // Strict validation: check if the booking_id is null, undefined, or empty
        if (!bookingId || bookingId.trim() === '') {
            showError(
                statusContainer, 
                "Link Invalid or Expired", 
                "This confirmation link is invalid, expired, or corrupted. Please check your email or contact customer support for assistance."
            );
            return;
        }
        
        // Store the booking_id in a constant variable and log to console
        const validatedBookingId = bookingId;
        console.log("Booking ID successfully extracted: ", validatedBookingId);

        // Display premium animated SVG loader during execution
        showLoader(statusContainer);

        // Asynchronously update database record in Supabase
        try {
            const { data, error } = await supabase
                .from('bookings')
                .update({ booking_status: 'confirmed' })
                .eq('id', validatedBookingId)
                .select();

            if (error) throw error;

            // Strict validation: check if a record was actually matched and updated
            if (!data || data.length === 0) {
                throw new Error("No matching booking record found to confirm.");
            }

            console.log("Successfully confirmed booking record in database:", data);

            // Render premium success feedback
            showSuccess(
                statusContainer,
                "Appointment Confirmed",
                "Your new appointment time has been successfully locked in. A professional detailer will arrive at your coordinates on schedule."
            );

        } catch (dbErr) {
            if (typeof Sentry !== 'undefined') {
                Sentry.captureException(dbErr);
            }
            console.error("Database update error:", dbErr);
            
            showError(
                statusContainer,
                "Confirmation Failed",
                "We were unable to secure your booking time. Please contact Basti's support directly to confirm your appointment."
            );
        }
        
    } catch (err) {
        // Log unexpected runtime errors to Sentry
        if (typeof Sentry !== 'undefined') {
            Sentry.captureException(err);
        }
        console.error("An unexpected error occurred during confirmation initialization:", err);
        
        showError(
            statusContainer, 
            "An Error Occurred", 
            "An unexpected error occurred while loading your booking details. Please try again or contact customer support."
        );
    }
});

/**
 * Dynamically renders a premium glassmorphic loader with an inline animated SVG.
 * 
 * @param {HTMLElement} container The DOM element to render the loader into.
 */
function showLoader(container) {
    if (!container) return;
    container.innerHTML = '';

    const loader = document.createElement('div');
    loader.className = 'loader-card';

    Object.assign(loader.style, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        gap: '1rem',
        animation: 'fadeIn 0.4s ease-out'
    });

    loader.innerHTML = `
        <svg width="44" height="44" viewBox="0 0 50 50" stroke="#ffffff">
            <g fill="none" fill-rule="evenodd">
                <g transform="translate(2 2)" stroke-width="3">
                    <circle stroke-opacity=".1" cx="22" cy="22" r="20"/>
                    <path d="M36 18c0-9.94-8.06-18-18-18">
                        <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="0 18 18"
                            to="360 18 18"
                            dur="0.8s"
                            repeatCount="indefinite"/>
                    </path>
                </g>
            </g>
        </svg>
        <p style="font-size: 0.9rem; color: var(--text-secondary); font-family: 'Outfit', sans-serif;">Securing your booking time...</p>
    `;

    container.appendChild(loader);
}

/**
 * Dynamically renders a premium glassmorphic success card.
 * 
 * @param {HTMLElement} container The DOM element to render the success card into.
 * @param {string} title The bold title of the success message.
 * @param {string} message The detailed description of the success.
 */
function showSuccess(container, title, message) {
    if (!container) return;
    container.innerHTML = '';

    const successCard = document.createElement('div');
    successCard.className = 'success-card';

    // Apply premium glassmorphic styling aligned with the global dark theme design tokens
    Object.assign(successCard.style, {
        background: 'rgba(74, 222, 128, 0.08)',
        border: '1px solid rgba(74, 222, 128, 0.3)',
        borderRadius: '16px',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(12px)',
        webkitBackdropFilter: 'blur(12px)',
        marginTop: '1.5rem',
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
        animation: 'fadeIn 0.4s ease-out'
    });

    successCard.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 1.25rem; display: flex; justify-content: center; align-items: center; color: #4ade80;">
            <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </div>
        <h2 style="font-size: 1.3rem; font-weight: 700; color: #ffffff; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em;">${title}</h2>
        <p style="font-size: 0.9rem; color: #a3a3ac; line-height: 1.6; max-width: 320px; margin: 0 auto;">${message}</p>
    `;

    container.appendChild(successCard);
}

/**
 * Dynamically renders a premium glassmorphic error card if URL validation fails.
 * 
 * @param {HTMLElement} container The DOM element to render the error card into.
 * @param {string} title The bold title of the error message.
 * @param {string} message The detailed description of the error.
 */
function showError(container, title, message) {
    if (!container) return;
    
    // Clear any previous loading spinner or dynamic elements
    container.innerHTML = '';
    
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
        marginTop: '1.5rem',
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
        <h2 style="font-size: 1.3rem; font-weight: 700; color: #ffffff; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em;">${title}</h2>
        <p style="font-size: 0.9rem; color: #a3a3ac; line-height: 1.6; max-width: 320px; margin: 0 auto;">${message}</p>
    `;
    
    container.appendChild(errorCard);
}
