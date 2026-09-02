// Database connection configuration variables
const SUPABASE_URL = "https://ylqiiopkxaivtgynlldd.supabase.co";
const SUPABASE_PUBLIC_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlscWlpb3BreGFpdnRneW5sbGRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0NTg0MjEsImV4cCI6MjEwMDAzNDQyMX0.L0L7Wea5-fwqniLgAKx8G2aq3l7VllD33NrV2CffZHE";

// Prevent runtime execution if placeholders are accidentally left behind
if (SUPABASE_URL === "YOUR_PROJECT_URL_HERE" || SUPABASE_PUBLIC_ANON_KEY === "YOUR_PUBLIC_ANON_KEY_HERE") {
    console.error("Database configuration error: Please replace the placeholder credential strings with your actual Supabase project details.");
}

// Initialize the Supabase Client Engine
const supabaseBackend = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_ANON_KEY);

/**
 * Transmits a verified booking payload directly to the Supabase database.
 * 
 * @param {string} vehicleType - Formatted summary of selected vehicles
 * @param {number} totalPrice - Total calculated booking price in ZAR
 * @param {string} bookingDateTime - ISO 8601 formatted timestamp string
 * @param {string} customerAddress - Target destination for mobile detailing unit deployment
 * @param {string} customerEmail - Customer contact email address
 * @param {string} customerName - Customer contact name
 * @param {string} customerPhone - Customer contact phone number
 * @param {number} hatchbackQty - Count of Hatchback & Sedan vehicles
 * @param {number} suvQty - Count of SUV & Bakkie vehicles
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function insertNewBooking(vehicleType, totalPrice, bookingDateTime, customerAddress, customerEmail, customerName, customerPhone, hatchbackQty, suvQty) {
    try {
        // Enforce NOT NULL data constraints & minimum vehicle quantity validation
        if (
            !vehicleType ||
            !totalPrice ||
            !bookingDateTime ||
            !customerAddress ||
            !customerEmail ||
            !customerName ||
            !customerPhone ||
            hatchbackQty === undefined ||
            suvQty === undefined ||
            (Number(hatchbackQty) + Number(suvQty)) <= 0
        ) {
            throw new Error("Payload error: Required fields (Name, Phone, vehicle quantities > 0, etc.) are missing.");
        }

        const { data, error } = await supabaseBackend
            .from('bookings')
            .insert([
                {
                    vehicle_type: vehicleType,
                    total_price: totalPrice,
                    hatchback_qty: hatchbackQty,
                    suv_qty: suvQty,
                    booking_date_time: bookingDateTime,
                    customer_address: customerAddress,
                    customer_email: customerEmail,
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    booking_status: 'pending'
                }
            ])
            .select();

        if (error) {
            console.error("Database Insert Exception encountered:", error.message);
            if (window.Sentry) {
                Sentry.captureException(error);
            }
            return { success: false, error: error.message };
        }

        console.log("Booking successfully recorded:", data);
        return { success: true, data: data };
    } catch (catchError) {
        console.error("Network runtime failure:", catchError);
        if (window.Sentry) {
            Sentry.captureException(catchError);
        }
        return { success: false, error: catchError.message };
    }
}

/**
 * Displays a premium glassmorphic toast notification to the user in the DOM.
 * 
 * @param {string} message - Message text to show.
 * @param {'success' | 'error'} type - Style theme of the notification.
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Create toast component
    const toastElement = document.createElement('div');
    toastElement.className = `toast toast-${type}`;

    // Select the appropriate stroke icon
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5">
            <path d="M20 6L9 17L4 12" stroke-linecap="round" stroke-linejoin="round" />
        </svg>`;
    } else {
        iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
        </svg>`;
    }

    toastElement.innerHTML = `
        <div class="toast-icon">${iconSvg}</div>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toastElement);

    // Fade and slide in
    setTimeout(() => {
        toastElement.classList.add('show');
    }, 50);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
        toastElement.classList.remove('show');
        setTimeout(() => {
            toastElement.remove();
        }, 300);
    }, 4000);
}

// Multi-vehicle booking numerical quantity state tracking
let hatchbackQty = 0;
let suvQty = 0;

// Orchestrate DOM interactions when markup structure is parsed
document.addEventListener('DOMContentLoaded', () => {
    // Select dynamic elements on the page
    const priceDisplayVal = document.getElementById('price-display-val');
    const btnBookNow = document.getElementById('btn-book-now');

    // Vehicle Counter & Card Selectors
    const cardHatchback = document.getElementById('card-hatchback');
    const cardSUV = document.getElementById('card-suv');
    const btnHatchbackMinus = document.getElementById('btn-hatchback-minus');
    const btnHatchbackPlus = document.getElementById('btn-hatchback-plus');
    const hatchbackQtyDisplay = document.getElementById('hatchback-qty');
    const btnSuvMinus = document.getElementById('btn-suv-minus');
    const btnSuvPlus = document.getElementById('btn-suv-plus');
    const suvQtyDisplay = document.getElementById('suv-qty');

    // Fallbacks for pending refactoring steps
    const radioHatchback = document.getElementById('vehicle-hatchback') || { checked: false };
    const radioSUV = document.getElementById('vehicle-suv') || { checked: false };

    // Modal Selectors
    const bookingModal = document.getElementById('booking-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const modalVehicleDisplay = document.getElementById('modal-vehicle-display');
    const modalPriceDisplay = document.getElementById('modal-price-display');
    const bookingForm = document.getElementById('booking-form');

    // Input Selectors
    const customerNameInput = document.getElementById('customer-name');
    const customerPhoneInput = document.getElementById('customer-phone');
    const customerEmailInput = document.getElementById('customer-email');
    const customerAddressInput = document.getElementById('customer-address');
    const bookingDateTimeInput = document.getElementById('booking-date-time');

    // Dynamic pricing calculation based on selected vehicle quantities
    function updatePricingState() {
        try {
            const total = (hatchbackQty * 100) + (suvQty * 120);
            if (priceDisplayVal) {
                priceDisplayVal.textContent = String(total);
            }
        } catch (error) {
            console.error('Error updating pricing state:', error);
            if (window.Sentry) {
                Sentry.captureException(error);
            }
        }
    }

    /**
     * Synchronizes vehicle counter displays, decrement button disabled states,
     * and active card highlights with current numerical quantity state.
     */
    function updateVehicleCardUI() {
        try {
            // Update numeric quantity text displays
            if (hatchbackQtyDisplay) {
                hatchbackQtyDisplay.textContent = String(hatchbackQty);
            }
            if (suvQtyDisplay) {
                suvQtyDisplay.textContent = String(suvQty);
            }

            // Toggle disabled state & styling on decrement buttons
            if (btnHatchbackMinus) {
                btnHatchbackMinus.disabled = (hatchbackQty === 0);
                btnHatchbackMinus.classList.toggle('disabled', hatchbackQty === 0);
            }
            if (btnSuvMinus) {
                btnSuvMinus.disabled = (suvQty === 0);
                btnSuvMinus.classList.toggle('disabled', suvQty === 0);
            }

            // Toggle active card styling based on quantity selection
            if (cardHatchback) {
                if (hatchbackQty > 0) {
                    cardHatchback.classList.add('active');
                } else {
                    cardHatchback.classList.remove('active');
                }
            }
            if (cardSUV) {
                if (suvQty > 0) {
                    cardSUV.classList.add('active');
                } else {
                    cardSUV.classList.remove('active');
                }
            }

            // Trigger pricing calculation update
            if (typeof updatePricingState === 'function') {
                updatePricingState();
            }
        } catch (error) {
            if (window.Sentry) {
                Sentry.captureException(error);
            }
            console.error('Error updating vehicle card UI:', error);
        }
    }

    // Bind quantity counter control event listeners
    if (btnHatchbackPlus) {
        btnHatchbackPlus.addEventListener('click', () => {
            try {
                hatchbackQty += 1;
                updateVehicleCardUI();
            } catch (error) {
                if (window.Sentry) {
                    Sentry.captureException(error);
                }
                console.error('Error incrementing hatchback quantity:', error);
            }
        });
    }

    if (btnHatchbackMinus) {
        btnHatchbackMinus.addEventListener('click', () => {
            try {
                hatchbackQty = Math.max(0, hatchbackQty - 1);
                updateVehicleCardUI();
            } catch (error) {
                if (window.Sentry) {
                    Sentry.captureException(error);
                }
                console.error('Error decrementing hatchback quantity:', error);
            }
        });
    }

    if (btnSuvPlus) {
        btnSuvPlus.addEventListener('click', () => {
            try {
                suvQty += 1;
                updateVehicleCardUI();
            } catch (error) {
                if (window.Sentry) {
                    Sentry.captureException(error);
                }
                console.error('Error incrementing SUV quantity:', error);
            }
        });
    }

    if (btnSuvMinus) {
        btnSuvMinus.addEventListener('click', () => {
            try {
                suvQty = Math.max(0, suvQty - 1);
                updateVehicleCardUI();
            } catch (error) {
                if (window.Sentry) {
                    Sentry.captureException(error);
                }
                console.error('Error decrementing SUV quantity:', error);
            }
        });
    }

    // Set initial UI state (counters at 0, minus buttons disabled, cards unselected)
    updateVehicleCardUI();

    // Converts numerical vehicle counts into human-readable summary strings
    function getVehicleSummaryString(hatchbackQty, suvQty) {
        try {
            if (hatchbackQty > 0 && suvQty > 0) {
                return `${hatchbackQty}x Hatchback & Sedan, ${suvQty}x SUV & Bakkie`;
            } else if (hatchbackQty > 0) {
                return `${hatchbackQty}x Hatchback & Sedan`;
            } else if (suvQty > 0) {
                return `${suvQty}x SUV & Bakkie`;
            } else {
                return "";
            }
        } catch (error) {
            console.error('Error generating vehicle summary string:', error);
            if (window.Sentry) {
                Sentry.captureException(error);
            }
            return "";
        }
    }

    // Helper function to reveal the booking modal overlay with multi-vehicle details
    function openBookingModal() {
        try {
            const totalPrice = (hatchbackQty * 100) + (suvQty * 120);
            const vehicleSummary = getVehicleSummaryString(hatchbackQty, suvQty);

            if (modalVehicleDisplay) {
                modalVehicleDisplay.textContent = vehicleSummary || 'No vehicle selected';
            }
            if (modalPriceDisplay) {
                modalPriceDisplay.textContent = 'R' + totalPrice;
            }

            document.body.style.overflow = 'hidden';

            if (btnBookNow) {
                btnBookNow.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    btnBookNow.style.transform = '';
                    if (bookingModal) {
                        bookingModal.classList.remove('hidden');
                        setTimeout(() => {
                            bookingModal.classList.add('active');
                        }, 10);
                    }
                }, 120);
            } else if (bookingModal) {
                bookingModal.classList.remove('hidden');
                setTimeout(() => {
                    bookingModal.classList.add('active');
                }, 10);
            }
        } catch (error) {
            showToast('Failed to open booking details. Please try again.', 'error');
            console.error('Error opening booking details modal:', error);
            if (window.Sentry) {
                Sentry.captureException(error);
            }
        }
    }

    // Open Booking Modal Trigger
    btnBookNow.addEventListener('click', () => {
        try {
            const totalVehicles = hatchbackQty + suvQty;
            if (totalVehicles <= 0) {
                showToast('Please select at least one vehicle to proceed with booking.', 'error');
                return;
            }

            openBookingModal();
        } catch (error) {
            showToast('Unable to open booking form. Please try again.', 'error');
            console.error('Error opening booking modal:', error);
            if (window.Sentry) {
                Sentry.captureException(error);
            }
        }
    });

    // Close Booking Modal function
    function closeModal() {
        document.body.style.overflow = '';
        bookingModal.classList.remove('active');
        setTimeout(() => {
            bookingModal.classList.add('hidden');
        }, 300);
    }

    // Modal close binds
    btnCloseModal.addEventListener('click', closeModal);

    // Close modal when clicking on the surrounding backdrop
    bookingModal.addEventListener('click', (event) => {
        if (event.target === bookingModal) {
            closeModal();
        }
    });

    // Parse URL query parameter for booking_id to autofill rebooking details
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('booking_id');

    if (bookingId) {
        (async function loadRebookingDetails() {
            try {
                const { data, error } = await supabaseBackend
                    .from('bookings')
                    .select('customer_name, customer_phone, customer_email, customer_address, vehicle_type')
                    .eq('id', bookingId)
                    .single();

                if (error) {
                    throw error;
                }

                if (data) {
                    // Populate DOM fields with retrieved customer profile details
                    customerNameInput.value = data.customer_name || '';
                    customerPhoneInput.value = data.customer_phone || '';
                    customerEmailInput.value = data.customer_email || '';
                    customerAddressInput.value = data.customer_address || '';
                    
                    // Force the user to choose a new booking date and time
                    bookingDateTimeInput.value = '';

                    // Synchronize the package checkboxes/radios and update UI pricing/labels
                    if (data.vehicle_type === 'Hatchback & Sedan') {
                        radioHatchback.checked = true;
                        radioSUV.checked = false;
                        priceDisplayVal.textContent = '100';
                        modalVehicleDisplay.textContent = 'Hatchback & Sedan';
                        modalPriceDisplay.textContent = 'R100';
                    } else if (data.vehicle_type === 'SUV & Bakkie') {
                        radioHatchback.checked = false;
                        radioSUV.checked = true;
                        priceDisplayVal.textContent = '120';
                        modalVehicleDisplay.textContent = 'SUV & Bakkie';
                        modalPriceDisplay.textContent = 'R120';
                    }

                    // Programmatically reveal the booking modal
                    bookingModal.classList.remove('hidden');
                    setTimeout(() => {
                        bookingModal.classList.add('active');
                    }, 10);

                    // Clean the URL parameters to prevent re-execution on page reload
                    const url = new URL(window.location.href);
                    url.searchParams.delete('booking_id');
                    window.history.replaceState({}, document.title, url.pathname + url.search);
                }
            } catch (err) {
                if (typeof Sentry !== 'undefined') {
                    Sentry.captureException(err);
                }
                console.error('Failed to pre-populate rebooking details:', err);
                showToast('Unable to retrieve previous booking details. Please complete the form manually.', 'error');
            }
        })();
    }

    // Handle form submission and validation
    if (bookingForm) {
        bookingForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            // Extract values and sanitize
            const customerName = customerNameInput.value.trim();
            const customerPhone = customerPhoneInput.value.trim();
            const customerEmail = customerEmailInput.value.trim();
            const customerAddress = customerAddressInput.value.trim();
            const bookingDateTime = bookingDateTimeInput.value;

            // Multi-vehicle specification & dynamic pricing
            const vehicleType = getVehicleSummaryString(hatchbackQty, suvQty);
            const totalPrice = (hatchbackQty * 100) + (suvQty * 120);

            // --- Regex Validation Layer ---

            // 1. South African Phone Format (10 digits starting with 0)
            const cleanPhone = customerPhone.replace(/[\s\-\(\)]/g, ''); // strip spaces, hyphens, parentheses
            const saPhoneRegex = /^0\d{9}$/;
            if (!saPhoneRegex.test(cleanPhone)) {
                showToast('Please enter a valid 10-digit South African phone number (e.g. 082 123 4567).', 'error');
                customerPhoneInput.focus();
                return;
            }

            // 2. Email Syntax Check
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(customerEmail)) {
                showToast('Please enter a valid email address (e.g. customer@domain.co.za).', 'error');
                customerEmailInput.focus();
                return;
            }

            // 3. Date & Time future check
            const selectedDate = new Date(bookingDateTime);
            const currentDate = new Date();
            if (isNaN(selectedDate.getTime())) {
                showToast('Please select a valid date and time.', 'error');
                bookingDateTimeInput.focus();
                return;
            }
            if (selectedDate < currentDate) {
                showToast('Booking date and time cannot be in the past.', 'error');
                bookingDateTimeInput.focus();
                return;
            }

            // State Capture: Write payload to session storage
            const sessionPayload = {
                customerName: customerName,
                customerPhone: cleanPhone,
                customerEmail: customerEmail,
                customerAddress: customerAddress,
                bookingDateTime: bookingDateTime,
                vehicleType: vehicleType,
                hatchback_qty: hatchbackQty,
                suv_qty: suvQty,
                totalPrice: totalPrice,
                timestamp: new Date().toISOString()
            };

            try {
                sessionStorage.setItem('latest_booking', JSON.stringify(sessionPayload));
                console.log('Booking state successfully saved to session storage.', sessionPayload);
            } catch (storageError) {
                console.warn('Unable to write to session storage:', storageError);
                if (window.Sentry) {
                    Sentry.captureException(storageError);
                }
            }

            // Backend Transmission payload validation and formatting
            const formattedIsoDateTime = selectedDate.toISOString();

            // Display loading feedback
            const submitBtn = document.getElementById('btn-submit-booking');
            const submitBtnSpan = submitBtn.querySelector('span');
            const originalBtnText = submitBtnSpan.textContent;
            submitBtnSpan.textContent = 'Processing...';
            submitBtn.disabled = true;

            // Execute the database insert function
            const result = await insertNewBooking(
                vehicleType,
                totalPrice,
                formattedIsoDateTime,
                customerAddress,
                customerEmail,
                customerName,
                customerPhone,
                hatchbackQty,
                suvQty
            );

            // Re-enable button
            submitBtnSpan.textContent = originalBtnText;
            submitBtn.disabled = false;

            if (result.success) {
                // 1. Construct and store comprehensive multi-vehicle booking details in sessionStorage
                try {
                    const bookingRecord = (result.data && result.data[0]) ? result.data[0] : {};
                    const bookingId = bookingRecord.id || null;

                    const lastBookingDetails = {
                        bookingId: bookingId,
                        vehicleSummary: vehicleType,
                        vehicleType: vehicleType,
                        hatchback_qty: hatchbackQty,
                        suv_qty: suvQty,
                        totalPrice: totalPrice,
                        customerName: customerName,
                        customerEmail: customerEmail,
                        customerPhone: cleanPhone,
                        customerAddress: customerAddress,
                        bookingDateTime: formattedIsoDateTime,
                        timestamp: new Date().toISOString()
                    };

                    sessionStorage.setItem('lastBooking', JSON.stringify(lastBookingDetails));
                    sessionStorage.setItem('latest_booking', JSON.stringify(lastBookingDetails));
                    console.log('Successfully cached booking details in sessionStorage:', lastBookingDetails);
                } catch (storageErr) {
                    console.error('Failed to cache booking details in sessionStorage:', storageErr);
                    if (window.Sentry) {
                        Sentry.captureException(storageErr);
                    }
                }

                // 2. Complete state and UI reset back to initial defaults
                try {
                    // Reset numerical quantity variables to zero
                    hatchbackQty = 0;
                    suvQty = 0;

                    // Reset vehicle counter displays and decrement button disabled states
                    updateVehicleCardUI();

                    // Reset main page dynamic price display back to 0
                    updatePricingState();

                    // Reset HTML form fields
                    bookingForm.reset();

                    // Restore body scroll
                    document.body.style.overflow = '';
                } catch (resetErr) {
                    console.error('Failed to reset booking UI and numerical state:', resetErr);
                    if (window.Sentry) {
                        Sentry.captureException(resetErr);
                    }
                }

                showToast("Booking request recieved! Keep an eye on your inbox, we'll confirm your appointment soon.", "success");

                // Close the modal after a short delay to allow success toast to be read
                setTimeout(() => {
                    closeModal();
                }, 4000);
            } else {
                showToast(`Booking submission failed: ${result.error}`, "error");
            }
        });
    }
});