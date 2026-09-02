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
 * @param {string} vehicleType - Must match 'Hatchback & Sedan' or 'SUV & Bakkie'
 * @param {number} totalPrice - Must be exactly 100 or 120 matching the regional currency pricing
 * @param {string} bookingDateTime - ISO 8601 formatted timestamp string
 * @param {string} customerAddress - Target destination for mobile detailing unit deployment
 * @param {string} customerEmail - Customer contact email address
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function insertNewBooking(vehicleType, totalPrice, bookingDateTime, customerAddress, customerEmail, customerName, customerPhone) {
    try {
        // Enforce NOT NULL data constraints
        if (!vehicleType || !totalPrice || !bookingDateTime || !customerAddress || !customerEmail || !customerName || !customerPhone) {
            throw new Error("Payload error: Required fields (Name, Phone, etc.) are missing.");
        }

        const { data, error } = await supabaseBackend
            .from('bookings')
            .insert([
                {
                    vehicle_type: vehicleType,
                    total_price: totalPrice,
                    booking_date_time: bookingDateTime,
                    customer_address: customerAddress,
                    customer_email: customerEmail,
                    customer_name: customerName,    // Added
                    customer_phone: customerPhone,  // Added
                    booking_status: 'pending'
                }
            ])
            .select();

        if (error) {
            console.error("Database Insert Exception encountered:", error.message);
            return { success: false, error: error.message };
        }

        console.log("Booking successfully recorded:", data);
        return { success: true, data: data };
    } catch (catchError) {
        console.error("Network runtime failure:", catchError);
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

    // Live update for pricing on package selection (will be fully calculated in Step 4)
    function updatePricingState() {
        try {
            if (priceDisplayVal) {
                const total = (hatchbackQty * 100) + (suvQty * 120);
                priceDisplayVal.textContent = total > 0 ? String(total) : '100';
            }
        } catch (error) {
            if (window.Sentry) {
                Sentry.captureException(error);
            }
            console.error('Error updating pricing state:', error);
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

    // Open Booking Modal Trigger
    btnBookNow.addEventListener('click', () => {
        // Read active state of radio inputs
        const vehicleType = radioHatchback.checked ? 'Hatchback & Sedan' : 'SUV & Bakkie';
        const totalPrice = radioHatchback.checked ? '100' : '120';

        // Pre-populate modal overview labels
        modalVehicleDisplay.textContent = vehicleType;
        modalPriceDisplay.textContent = `R${totalPrice}`;

        // Subtle button scaling interaction
        btnBookNow.style.transform = 'scale(0.95)';
        setTimeout(() => {
            btnBookNow.style.transform = '';

            // Present hidden modal overlay
            bookingModal.classList.remove('hidden');
            // Allow container transitions to trigger correctly
            setTimeout(() => {
                bookingModal.classList.add('active');
            }, 10);
        }, 120);
    });

    // Close Booking Modal function
    function closeModal() {
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

            // Extract selected vehicle specifications
            const isHatch = radioHatchback.checked;
            const vehicleType = isHatch ? 'Hatchback & Sedan' : 'SUV & Bakkie';
            const totalPrice = isHatch ? 100 : 120;

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
                totalPrice: totalPrice,
                timestamp: new Date().toISOString()
            };

            try {
                sessionStorage.setItem('latest_booking', JSON.stringify(sessionPayload));
                console.log('Booking state successfully saved to session storage.', sessionPayload);
            } catch (storageError) {
                console.warn('Unable to write to session storage:', storageError);
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
                customerName,    // Ensure this matches the variable defined above
                customerPhone    // Ensure this matches the variable defined above
            );

            // Re-enable button
            submitBtnSpan.textContent = originalBtnText;
            submitBtn.disabled = false;

            if (result.success) {
                showToast("Booking request recieved! Keep an eye on your inbox, we'll confirm your appointment soon.", "success");
                bookingForm.reset();
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