Sentry.init({
    dsn: "https://c9c73abcccb7521e6d5c9f4b62c204a6@o4511825776279552.ingest.de.sentry.io/4511825788993616"
});

window.addEventListener('unhandledrejection', function (event) {
    Sentry.captureException(event.reason);
});

// Global state for tracking incoming 'pending' bookings
let unreadCount = 0;

// Update UI logic for the notification bell badge
function updateNotificationBadge(count) {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        if (count > 0) {
            badge.innerText = count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Automatic session check on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (session) {
            // Hide the login screen and show the dashboard
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('dashboard-container').style.display = 'block';

            // Automatically fetch and render the initial pending bookings
            const { data: pendingData, error: pendingError } = await fetchBookingsByStatus('pending');
            if (!pendingError && pendingData) {
                renderPendingBookings(pendingData);
            }

            // Execute the offline notification count
            const { count, error: countError } = await supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('booking_status', 'pending');

            if (!countError && count !== null) {
                unreadCount = count;
            }
            updateNotificationBadge(unreadCount);

            // Establish the Realtime channel subscription for the restored session
            if (typeof supabaseBackend === 'undefined') {
                window.supabaseBackend = window.supabase;
            }

            supabaseBackend
                .channel('public:bookings')
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'bookings' },
                    (payload) => {
                        unreadCount++;
                        updateNotificationBadge(unreadCount);
                        new Audio('assets/chime.mp3').play().catch(e => console.log('Audio blocked by browser'));
                    }
                )
                .subscribe();
        } else {
            // Ensure default state: login is visible, dashboard is hidden
            document.getElementById('login-container').style.display = 'block';
            document.getElementById('dashboard-container').style.display = 'none';
        }
    } catch (err) {
        console.error("Session restoration error:", err);
        // Ensure default state on error
        document.getElementById('login-container').style.display = 'block';
        document.getElementById('dashboard-container').style.display = 'none';
    }
});

// Event listener for secure login button
document.getElementById('login-btn').addEventListener('click', async () => {
    const emailInput = document.getElementById('admin-email').value;
    const passwordInput = document.getElementById('admin-password').value;

    try {
        // Call Supabase authentication endpoint
        const { data, error } = await supabase.auth.signInWithPassword({
            email: emailInput,
            password: passwordInput
        });

        // Explicitly throw if Supabase returns an error object
        if (error) {
            throw error;
        }

        // If login is successful, hide the login container and display the dashboard
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('dashboard-container').style.display = 'block';

        // Establish the initial unread count of pending bookings
        try {
            const { count, error: countError } = await supabase
                .from('bookings')
                .select('*', { count: 'exact', head: true })
                .eq('booking_status', 'pending');

            if (!countError && count !== null) {
                unreadCount = count;
            }
            updateNotificationBadge(unreadCount);

            if (typeof supabaseBackend === 'undefined') {
                window.supabaseBackend = window.supabase;
            }

            supabaseBackend
                .channel('public:bookings')
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'bookings' },
                    (payload) => {
                        unreadCount++;
                        updateNotificationBadge(unreadCount);
                        new Audio('assets/chime.mp3').play().catch(e => console.log('Audio blocked by browser'));
                    }
                )
                .subscribe();
        } catch (err) {
            console.error("Error fetching initial unread count:", err);
        }

        // Automatically fetch and render pending bookings for the initial view
        const { data: pendingData, error: pendingError } = await fetchBookingsByStatus('pending');
        if (!pendingError && pendingData) {
            renderPendingBookings(pendingData);
        }

    } catch (error) {
        // Intercept authentication errors and trigger toast notification
        console.error("Authentication Error:", error.message || error);
        showToast("Invalid Credentials");
    }
});

// Dynamically display error toast notifications
function showToast(message) {
    const toast = document.createElement('div');
    toast.innerText = message;

    // Apply premium inline CSS styling for a vibrant, glassmorphic red error toast
    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: 'rgba(239, 68, 68, 0.9)', // Vibrant red
        color: '#ffffff',
        padding: '16px 24px',
        borderRadius: '12px',
        fontFamily: "'Outfit', -apple-system, sans-serif",
        fontSize: '14px',
        fontWeight: '500',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: '9999',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: 'translateY(-20px)',
        opacity: '0'
    });

    document.body.appendChild(toast);

    // Force reflow and slide/fade in
    setTimeout(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    }, 10);

    // Start fade out transition before removing
    setTimeout(() => {
        toast.style.transform = 'translateY(-20px)';
        toast.style.opacity = '0';
    }, 2700);

    // Fully remove from DOM after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Event listener for secure logout button
document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
        await supabase.auth.signOut();
        document.getElementById('dashboard-container').style.display = 'none';
        document.getElementById('login-container').style.display = 'block';
    } catch (error) {
        console.error("Logout Error:", error.message || error);
    }
});

/**
 * Asynchronously fetches bookings from Supabase by their status.
 *
 * @param {string} statusType - The booking status type to filter by (e.g., 'pending', 'confirmed').
 * @param {number|null} [recordLimit=null] - Maximum number of records to retrieve.
 * @returns {Promise<{data: Array<Object>|null, error: Object|null}>} The resulting data and error from Supabase.
 */
async function fetchBookingsByStatus(statusType, recordLimit = null) {
    // Ensure the supabaseBackend instance is used (falling back to window.supabase if necessary)
    if (typeof supabaseBackend === 'undefined') {
        window.supabaseBackend = window.supabase;
    }

    // Construct base query selecting all columns from 'bookings' table
    let query = supabaseBackend
        .from('bookings')
        .select('*')
        .eq('booking_status', statusType)
        .order('booking_date_time', { ascending: false });

    // Data Avalanche Fix: Check if recordLimit is truthy before appending
    if (recordLimit) {
        query = query.limit(recordLimit);
    }

    // Await query execution and return the raw Supabase result payload
    const { data, error } = await query;
    return { data, error };
}

// Universal Tab-Switching Controller
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', async () => {
        const targetId = button.getAttribute('data-target');
        
        // Remove active class from all buttons and sections, and clear inline styles
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.background = 'transparent';
            btn.style.color = '#a3a3ac';
        });
        document.querySelectorAll('.tab-content').forEach(section => {
            section.classList.remove('active');
            section.style.display = 'none';
        });
        
        // Add active class to clicked button and target section, and set active inline styles
        button.classList.add('active');
        button.style.background = 'rgba(255, 255, 255, 0.1)';
        button.style.color = '#fff';
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.add('active');
            targetSection.style.display = 'block';
        }

        // Fetch and render data dynamically based on the active tab
        if (targetId === 'view-pending') {
            try {
                const { data, error } = await fetchBookingsByStatus('pending');
                if (error) throw error;
                renderPendingBookings(data);
            } catch (err) {
                console.error("Error loading pending bookings:", err);
                showToast("Network error: Could not load pending bookings.");
            }
        } else if (targetId === 'view-confirmed') {
            try {
                const { data, error } = await fetchBookingsByStatus('confirmed');
                if (error) throw error;
                renderConfirmedBookings(data);
            } catch (err) {
                console.error("Error loading confirmed bookings:", err);
                showToast("Network error: Could not load confirmed bookings.");
            }
        } else if (targetId === 'view-schedule') {
            generateCalendar(currentMonth, currentYear);
        } else if (targetId === 'view-completed') {
            try {
                completedRecordLimit = 50;
                const { data, error } = await fetchBookingsByStatus('completed', completedRecordLimit);
                if (error) throw error;
                renderCompletedBookings(data);
            } catch (err) {
                console.error("Error loading completed bookings:", err);
                showToast("Network error: Could not load completed bookings.");
            }
        } else if (targetId === 'view-cancelled') {
            try {
                cancelledRecordLimit = 50;
                const { data, error } = await fetchBookingsByStatus('cancelled', cancelledRecordLimit);
                if (error) throw error;
                renderCancelledBookings(data);
            } catch (err) {
                console.error("Error loading cancelled bookings:", err);
                showToast("Network error: Could not load cancelled bookings.");
            }
        }
    });
});

/**
 * Toggle the text content of the pending heading based on the view type.
 * @param {string} viewType - The type of view to display ('default' or 'proposed').
 */
function togglePendingHeadingView(viewType) {
    const heading = document.getElementById('pending-heading');
    if (!heading) return;

    if (viewType === 'default') {
        heading.innerText = 'Pending Confirmation';
    } else if (viewType === 'proposed') {
        heading.innerText = 'Pending Proposed New Times';
    }
}

/**
 * Render pending bookings cards inside the pending tab section.
 * @param {Array<Object>} data - Array of booking objects from Supabase.
 */
function renderPendingBookings(data) {
    const section = document.getElementById('view-pending');
    if (!section) return;

    // Clear existing booking cards to prevent duplicates, preserving other static headers
    section.querySelectorAll('.booking-card').forEach(card => card.remove());
    section.querySelectorAll('.no-bookings').forEach(el => el.remove());

    if (!data || data.length === 0) {
        const noBookings = document.createElement('div');
        noBookings.className = 'no-bookings';
        noBookings.innerText = 'No pending bookings found.';
        section.appendChild(noBookings);
        return;
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    data.forEach(booking => {
        // Format booking date time safely with standard JS Date methods
        let formattedDate = 'N/A';
        if (booking.booking_date_time) {
            const dateObj = new Date(booking.booking_date_time);
            const day = dateObj.getDate();
            const month = months[dateObj.getMonth()];
            const year = dateObj.getFullYear();
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            formattedDate = `${day} ${month} ${year}, ${hours}:${minutes}`;
        }

        const card = document.createElement('div');
        card.className = 'booking-card';
        card.setAttribute('data-id', booking.id);

        card.innerHTML = `
            <div class="view-a">
                <div class="customer-info-row">
                    <span class="customer-name">${booking.customer_name || 'N/A'}</span>
                    <span class="vehicle-type">${booking.vehicle_type || 'N/A'}</span>
                </div>
                <div class="booking-time">${formattedDate}</div>
            </div>
            <div class="view-b" style="display: none;">
                <div class="details-grid">
                    <p><strong>Phone:</strong> ${booking.customer_phone || 'N/A'}</p>
                    <p><strong>Email:</strong> ${booking.customer_email || 'N/A'}</p>
                    <p><strong>Address:</strong> ${booking.customer_address || 'N/A'}</p>
                    <p><strong>Total Price:</strong> R${booking.total_price || '0.00'}</p>
                </div>
                <div class="action-buttons">
                    ${booking.booking_status === 'admin_proposed' ? `
                        <a href="tel:${booking.customer_phone || ''}" class="btn-call" style="display: flex; align-items: center; justify-content: center; text-decoration: none; text-align: center; flex: 1; min-height: 44px; box-sizing: border-box; border-radius: var(--border-radius-md); font-size: 0.85rem; font-weight: 600; font-family: var(--font-family);">Call Customer</a>
                        <button class="btn-cancel">Cancel</button>
                    ` : booking.booking_status === 'customer_proposed' ? `
                        <button class="btn-confirm">Accept Counter</button>
                        <button class="btn-propose">Propose Time</button>
                        <a href="tel:${booking.customer_phone || ''}" class="btn-call" style="display: flex; align-items: center; justify-content: center; text-decoration: none; text-align: center; flex: 1; min-height: 44px; box-sizing: border-box; border-radius: var(--border-radius-md); font-size: 0.85rem; font-weight: 600; font-family: var(--font-family);">Call Customer</a>
                        <button class="btn-cancel">Cancel</button>
                    ` : `
                        <button class="btn-confirm">Confirm</button>
                        <button class="btn-propose">Propose Time</button>
                        <button class="btn-cancel">Cancel</button>
                    `}
                </div>
            </div>
        `;

        section.appendChild(card);
    });
}

/**
 * Render confirmed bookings cards inside the confirmed tab section.
 * @param {Array<Object>} data - Array of booking objects from Supabase.
 */
function renderConfirmedBookings(data) {
    const section = document.getElementById('view-confirmed');
    if (!section) return;

    // Clear existing booking cards to prevent duplicates, preserving other static headers
    section.querySelectorAll('.booking-card').forEach(card => card.remove());
    section.querySelectorAll('.no-bookings').forEach(el => el.remove());

    if (!data || data.length === 0) {
        const noBookings = document.createElement('div');
        noBookings.className = 'no-bookings';
        noBookings.innerText = 'No confirmed bookings found.';
        section.appendChild(noBookings);
        return;
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    data.forEach(booking => {
        // Format booking date time safely with standard JS Date methods
        let formattedDate = 'N/A';
        if (booking.booking_date_time) {
            const dateObj = new Date(booking.booking_date_time);
            const day = dateObj.getDate();
            const month = months[dateObj.getMonth()];
            const year = dateObj.getFullYear();
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            formattedDate = `${day} ${month} ${year}, ${hours}:${minutes}`;
        }

        const card = document.createElement('div');
        card.className = 'booking-card';
        card.setAttribute('data-id', booking.id);

        card.innerHTML = `
            <div class="view-a">
                <div class="customer-info-row">
                    <span class="customer-name">${booking.customer_name || 'N/A'}</span>
                    <span class="vehicle-type">${booking.vehicle_type || 'N/A'}</span>
                </div>
                <div class="booking-time">${formattedDate}</div>
            </div>
            <div class="view-b" style="display: none;">
                <div class="details-grid">
                    <p><strong>Phone:</strong> ${booking.customer_phone || 'N/A'}</p>
                    <p><strong>Email:</strong> ${booking.customer_email || 'N/A'}</p>
                    <p><strong>Address:</strong> ${booking.customer_address || 'N/A'}</p>
                    <p><strong>Total Price:</strong> R${booking.total_price || '0.00'}</p>
                </div>
                <div class="action-buttons">
                    <button class="btn-complete">Mark as Completed</button>
                </div>
            </div>
        `;

        section.appendChild(card);
    });
}

// Single event delegation listener on #view-pending for the accordion card toggling
document.getElementById('view-pending')?.addEventListener('click', (event) => {
    const viewA = event.target.closest('.view-a');
    if (viewA) {
        const card = viewA.closest('.booking-card');
        const viewB = card?.querySelector('.view-b');
        if (viewB && card) {
            if (viewB.style.display === 'none') {
                viewB.style.display = 'block';
                card.classList.add('expanded');
            } else {
                viewB.style.display = 'none';
                card.classList.remove('expanded');
            }
        }
    }
});

// Standalone event listener for Confirm Action
document.getElementById('view-pending')?.addEventListener('click', async (event) => {
    const btnConfirm = event.target.closest('.btn-confirm');
    if (!btnConfirm) return;

    const card = event.target.closest('.booking-card');
    if (!card) return;
    const bookingId = card.getAttribute('data-id');

    // Ensure supabaseBackend is available
    if (typeof supabaseBackend === 'undefined') {
        window.supabaseBackend = window.supabase;
    }

    try {
        const { error } = await supabaseBackend
            .from('bookings')
            .update({ booking_status: 'confirmed' })
            .eq('id', bookingId);

        if (error) throw error;

        showToast("Booking confirmed successfully.");

        const pendingData = await fetchBookingsByStatus('pending');
        renderPendingBookings(pendingData.data);

        const confirmedData = await fetchBookingsByStatus('confirmed');
        renderConfirmedBookings(confirmedData.data);

        generateCalendar(currentMonth, currentYear);
    } catch (err) {
        console.error("Confirm error:", err);
        showToast('Network error: Could not update booking. Please try again.');
    }
});

// Standalone event listener for Cancel Action
document.getElementById('view-pending')?.addEventListener('click', async (event) => {
    const btnCancel = event.target.closest('.btn-cancel');
    if (!btnCancel) return;

    const card = event.target.closest('.booking-card');
    if (!card) return;
    const bookingId = card.getAttribute('data-id');

    // Ensure supabaseBackend is available
    if (typeof supabaseBackend === 'undefined') {
        window.supabaseBackend = window.supabase;
    }

    try {
        const { error } = await supabaseBackend
            .from('bookings')
            .update({ booking_status: 'cancelled' })
            .eq('id', bookingId);

        if (error) throw error;

        showToast("Booking cancelled successfully.");

        const pendingData = await fetchBookingsByStatus('pending');
        renderPendingBookings(pendingData.data);

        const cancelledData = await fetchBookingsByStatus('cancelled', cancelledRecordLimit);
        renderCancelledBookings(cancelledData.data);
    } catch (err) {
        console.error("Cancel error:", err);
        showToast('Network error: Could not update booking. Please try again.');
    }
});

// Standalone event listener for Propose Time Action (Handler 2)
document.getElementById('view-pending')?.addEventListener('click', async (event) => {
    const btnPropose = event.target.closest('.btn-propose');
    if (!btnPropose) return;

    const card = event.target.closest('.booking-card');
    if (!card) return;
    const bookingId = card.getAttribute('data-id');

    activeBookingIdForProposal = bookingId;

    // Extract and parse the existing time
    const timeText = card.querySelector('.booking-time').innerText;
    const dateObj = new Date(timeText);
    
    if (!isNaN(dateObj)) {
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const hh = String(dateObj.getHours()).padStart(2, '0');
        const min = String(dateObj.getMinutes()).padStart(2, '0');
        
        document.getElementById('ptbm-date').value = `${yyyy}-${mm}-${dd}`;
        document.getElementById('ptbm-time').value = `${hh}:${min}`;
    }

    // Reveal the modal
    const modal = document.getElementById('ptbm-overlay');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
    }
});

// Standalone event listener for Close Modal (Handler 4)
document.getElementById('ptbm-btn-close')?.addEventListener('click', () => {
    const modal = document.getElementById('ptbm-overlay');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }, 300);
    }
    document.getElementById('ptbm-date').value = "";
    document.getElementById('ptbm-time').value = "";
});

// Submit event listener for the 'Propose Time' modal form
document.getElementById('ptbm-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitBtn = document.getElementById('ptbm-btn-submit');
    const dateVal = document.getElementById('ptbm-date').value;
    const timeVal = document.getElementById('ptbm-time').value;

    if (!activeBookingIdForProposal) {
        showToast("Error: No active booking selected.");
        return;
    }

    if (!dateVal || !timeVal) {
        showToast("Please select a date and time.");
        return;
    }

    // Combine date and time into a single valid ISO 8601 string
    const combinedDateTime = new Date(`${dateVal}T${timeVal}`).toISOString();

    // Ensure supabaseBackend is defined
    if (typeof supabaseBackend === 'undefined') {
        window.supabaseBackend = window.supabase;
    }

    // Disable submit button and show visual loading feedback
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Sending...';
    }

    try {
        // Execute the Supabase update query
        const { error } = await supabaseBackend
            .from('bookings')
            .update({
                booking_status: 'admin_proposed',
                booking_date_time: combinedDateTime
            })
            .eq('id', activeBookingIdForProposal);

        if (error) throw error;

        // Close the modal overlay
        const modal = document.getElementById('ptbm-overlay');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                modal.classList.add('hidden');
            }, 300);
        }

        // Clear the form inputs
        document.getElementById('ptbm-date').value = "";
        document.getElementById('ptbm-time').value = "";
        activeBookingIdForProposal = null;

        // Trigger success notification toast
        showToast("Proposal sent successfully!");

        // Find and Reset Pills
        document.querySelectorAll('.pending-pill-btn').forEach(btn => {
            btn.style.background = 'transparent';
            btn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            btn.style.color = '#a3a3ac';
        });

        // Activate Target Pill
        const targetPill = document.querySelector('.pending-pill-btn[data-status="admin_proposed"]');
        if (targetPill) {
            targetPill.style.background = 'rgba(255, 255, 255, 0.15)';
            targetPill.style.border = '1px solid rgba(255, 255, 255, 0.3)';
            targetPill.style.color = '#ffffff';
        }

        // Update Heading
        const heading = document.getElementById('pending-heading');
        if (heading) {
            heading.innerText = "Sent Proposals";
        }

        // Fetch and Render
        const updatedBookings = await fetchBookingsByStatus('admin_proposed');
        if (updatedBookings.error) throw updatedBookings.error;
        renderPendingBookings(updatedBookings.data);
    } catch (err) {
        Sentry.captureException(err);
        console.error("Propose time submit error:", err);
        showToast("Failed to send proposal. Please try again.");
    } finally {
        // Restore submit button state
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Send Proposal';
        }
    }
});

// Single event delegation listener on #view-confirmed for complete action button and accordion card toggling
document.getElementById('view-confirmed')?.addEventListener('click', async (event) => {
    const btnComplete = event.target.closest('.btn-complete');
    const viewA = event.target.closest('.view-a');

    // Handle Mark as Completed button click
    if (btnComplete) {
        const card = event.target.closest('.booking-card');
        if (!card) return;
        const bookingId = card.getAttribute('data-id');

        // Ensure supabaseBackend is available
        if (typeof supabaseBackend === 'undefined') {
            window.supabaseBackend = window.supabase;
        }

        try {
            const { error } = await supabaseBackend
                .from('bookings')
                .update({ booking_status: 'completed' })
                .eq('id', bookingId);

            if (error) throw error;

            showToast("Booking marked as completed.");

            const confirmedData = await fetchBookingsByStatus('confirmed');
            renderConfirmedBookings(confirmedData.data);

            const completedData = await fetchBookingsByStatus('completed', completedRecordLimit);
            renderCompletedBookings(completedData.data);
        } catch (err) {
            Sentry.captureException(err);
            console.error("Complete error:", err);
            showToast('Network error: Could not update booking. Please try again.');
        }
    }

    // Handle Accordion Expand/Collapse Toggle
    if (viewA) {
        const card = viewA.closest('.booking-card');
        const viewB = card?.querySelector('.view-b');
        if (viewB && card) {
            if (viewB.style.display === 'none') {
                viewB.style.display = 'block';
                card.classList.add('expanded');
            } else {
                viewB.style.display = 'none';
                card.classList.remove('expanded');
            }
        }
    }
});



// Variable to hold the active booking ID for calendar proposals
let activeBookingIdForProposal = null;



// Close button logic for the calendar modal
document.getElementById('close-calendar-btn')?.addEventListener('click', () => {
    const modal = document.getElementById('calendar-modal');
    if (modal) {
        modal.style.display = 'none';
    }
});

// Calendar state variables
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

/**
 * Generates and renders a monthly calendar view populated with confirmed bookings.
 * 
 * @param {number} month - The month index (0-11).
 * @param {number} year - The full year (e.g. 2026).
 */
async function generateCalendar(month, year) {
    const monthYearHeader = document.getElementById('calendar-month-year');
    const calendarGrid = document.getElementById('calendar-grid');
    if (!monthYearHeader || !calendarGrid) return;

    // Update the header text
    monthYearHeader.innerText = `${monthNames[month]} ${year}`;

    // Clear previous contents of the calendar grid
    calendarGrid.innerHTML = '';

    // Calculate number of days in the month and starting weekday
    const startingDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Create empty placeholder divs for offset days before the 1st of the month
    for (let i = 0; i < startingDay; i++) {
        const spacer = document.createElement('div');
        spacer.className = 'calendar-day-empty';
        spacer.style.minHeight = '80px';
        calendarGrid.appendChild(spacer);
    }

    // Create daily cells for the month
    for (let day = 1; day <= totalDays; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.setAttribute('data-day', day);
        Object.assign(dayCell.style, {
            minHeight: '80px',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '4px',
            overflowY: 'auto'
        });

        // Add the day number badge
        const dayNumber = document.createElement('span');
        Object.assign(dayNumber.style, {
            fontSize: '0.8rem',
            color: '#a3a3ac',
            display: 'block',
            fontWeight: '600',
            marginBottom: '4px'
        });
        dayNumber.innerText = day;
        dayCell.appendChild(dayNumber);

        calendarGrid.appendChild(dayCell);
    }

    // Fetch and populate confirmed bookings into the calendar days
    try {
        const { data, error } = await fetchBookingsByStatus('confirmed');
        if (error) throw error;

        if (data) {
            data.forEach(booking => {
                const dateObj = new Date(booking.booking_date_time);
                const bYear = dateObj.getFullYear();
                const bMonth = dateObj.getMonth();
                const bDay = dateObj.getDate();

                // If dates match, append visual indicator
                if (bYear === year && bMonth === month) {
                    const dayCell = calendarGrid.querySelector(`.calendar-day[data-day="${bDay}"]`);
                    if (dayCell) {
                        const hours = String(dateObj.getHours()).padStart(2, '0');
                        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                        const timeStr = `${hours}:${minutes}`;

                        const indicator = document.createElement('div');
                        Object.assign(indicator.style, {
                            background: 'rgba(74, 222, 128, 0.2)',
                            borderLeft: '2px solid #4ade80',
                            fontSize: '0.65rem',
                            padding: '2px 4px',
                            marginTop: '4px',
                            borderRadius: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            color: '#ffffff',
                            fontFamily: "'Outfit', sans-serif"
                        });
                        indicator.innerText = `${timeStr} - ${booking.customer_name || 'Customer'}`;
                        dayCell.appendChild(indicator);
                    }
                }
            });
        }
    } catch (err) {
        Sentry.captureException(err);
        console.error("Error populating calendar confirmed bookings:", err);
    }
}

// Calendar Navigation Button Event Listeners
document.getElementById('prev-month')?.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    generateCalendar(currentMonth, currentYear);
});

document.getElementById('next-month')?.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    generateCalendar(currentMonth, currentYear);
});

// Completed bookings pagination limit
let completedRecordLimit = 50;

/**
 * Render completed bookings cards inside the completed ledger container.
 * @param {Array<Object>} data - Array of booking objects from Supabase.
 */
function renderCompletedBookings(data) {
    const container = document.getElementById('completed-cards-container');
    if (!container) return;

    // Clear existing cards
    container.innerHTML = '';

    if (!data || data.length === 0) {
        const noBookings = document.createElement('div');
        noBookings.className = 'no-bookings';
        noBookings.innerText = 'No completed bookings found.';
        container.appendChild(noBookings);
        return;
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    data.forEach(booking => {
        // Format booking date time safely with standard JS Date methods
        let formattedDate = 'N/A';
        if (booking.booking_date_time) {
            const dateObj = new Date(booking.booking_date_time);
            const day = dateObj.getDate();
            const month = months[dateObj.getMonth()];
            const year = dateObj.getFullYear();
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            formattedDate = `${day} ${month} ${year}, ${hours}:${minutes}`;
        }

        const card = document.createElement('div');
        card.className = 'booking-card';
        card.setAttribute('data-id', booking.id);
        
        // Finalized aesthetic style overrides
        Object.assign(card.style, {
            background: 'rgba(20, 20, 20, 0.4)',
            opacity: '0.85',
            border: '1px solid rgba(255, 255, 255, 0.05)'
        });

        // Green checkmark SVG icon
        const greenCheckSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-left: 6px;"><path d="M20 6L9 17L4 12"/></svg>`;

        card.innerHTML = `
            <div class="view-a" style="cursor: pointer;">
                <div class="customer-info-row" style="display: flex; align-items: center; gap: 4px;">
                    <span class="customer-name">${booking.customer_name || 'N/A'} ${greenCheckSvg}</span>
                    <span class="vehicle-type">${booking.vehicle_type || 'N/A'}</span>
                </div>
                <div class="booking-time">${formattedDate}</div>
            </div>
            <div class="view-b" style="display: none;">
                <div class="details-grid">
                    <p><strong>Phone:</strong> ${booking.customer_phone || 'N/A'}</p>
                    <p><strong>Email:</strong> ${booking.customer_email || 'N/A'}</p>
                    <p><strong>Address:</strong> ${booking.customer_address || 'N/A'}</p>
                    <p><strong>Total Price:</strong> R${booking.total_price || '0.00'}</p>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

// Load More Historical Data logic
document.getElementById('load-more-completed')?.addEventListener('click', async () => {
    completedRecordLimit += 50;
    try {
        const { data, error } = await fetchBookingsByStatus('completed', completedRecordLimit);
        if (error) throw error;
        renderCompletedBookings(data);
    } catch (err) {
        console.error("Error loading more completed bookings:", err);
        showToast("Network error: Could not load more completed bookings.");
    }
});

// Single event delegation listener on #view-completed for accordion card toggling
document.getElementById('view-completed')?.addEventListener('click', (event) => {
    const viewA = event.target.closest('.view-a');
    if (viewA) {
        const card = viewA.closest('.booking-card');
        const viewB = card?.querySelector('.view-b');
        if (viewB && card) {
            if (viewB.style.display === 'none') {
                viewB.style.display = 'block';
                card.classList.add('expanded');
            } else {
                viewB.style.display = 'none';
                card.classList.remove('expanded');
            }
        }
    }
});

// Cancelled bookings pagination limit
let cancelledRecordLimit = 50;

/**
 * Render cancelled bookings cards inside the cancelled ledger container.
 * @param {Array<Object>} data - Array of booking objects from Supabase.
 */
function renderCancelledBookings(data) {
    const container = document.getElementById('cancelled-cards-container');
    if (!container) return;

    // Clear existing cards
    container.innerHTML = '';

    if (!data || data.length === 0) {
        const noBookings = document.createElement('div');
        noBookings.className = 'no-bookings';
        noBookings.innerText = 'No cancelled bookings found.';
        container.appendChild(noBookings);
        return;
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    data.forEach(booking => {
        // Format booking date time safely with standard JS Date methods
        let formattedDate = 'N/A';
        if (booking.booking_date_time) {
            const dateObj = new Date(booking.booking_date_time);
            const day = dateObj.getDate();
            const month = months[dateObj.getMonth()];
            const year = dateObj.getFullYear();
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            formattedDate = `${day} ${month} ${year}, ${hours}:${minutes}`;
        }

        const card = document.createElement('div');
        card.className = 'booking-card';
        card.setAttribute('data-id', booking.id);
        
        // Cancelled aesthetic style overrides: faint red border and muted background
        Object.assign(card.style, {
            background: 'rgba(20, 20, 20, 0.4)',
            opacity: '0.85',
            border: '1px solid rgba(248, 113, 113, 0.3)'
        });

        // Red 'X' SVG icon
        const redCrossSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-left: 6px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

        card.innerHTML = `
            <div class="view-a" style="cursor: pointer;">
                <div class="customer-info-row" style="display: flex; align-items: center; gap: 4px;">
                    <span class="customer-name">${booking.customer_name || 'N/A'} ${redCrossSvg}</span>
                    <span class="vehicle-type">${booking.vehicle_type || 'N/A'}</span>
                </div>
                <div class="booking-time">${formattedDate}</div>
            </div>
            <div class="view-b" style="display: none;">
                <div class="details-grid">
                    <p><strong>Phone:</strong> ${booking.customer_phone || 'N/A'}</p>
                    <p><strong>Email:</strong> ${booking.customer_email || 'N/A'}</p>
                    <p><strong>Address:</strong> ${booking.customer_address || 'N/A'}</p>
                    <p><strong>Total Price:</strong> R${booking.total_price || '0.00'}</p>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

// Load More Cancelled Historical Data logic
document.getElementById('load-more-cancelled')?.addEventListener('click', async () => {
    cancelledRecordLimit += 50;
    try {
        const { data, error } = await fetchBookingsByStatus('cancelled', cancelledRecordLimit);
        if (error) throw error;
        renderCancelledBookings(data);
    } catch (err) {
        console.error("Error loading more cancelled bookings:", err);
        showToast("Network error: Could not load more cancelled bookings.");
    }
});

// Single event delegation listener on #view-cancelled for accordion card toggling
document.getElementById('view-cancelled')?.addEventListener('click', (event) => {
    const viewA = event.target.closest('.view-a');
    if (viewA) {
        const card = viewA.closest('.booking-card');
        const viewB = card?.querySelector('.view-b');
        if (viewB && card) {
            if (viewB.style.display === 'none') {
                viewB.style.display = 'block';
                card.classList.add('expanded');
            } else {
                viewB.style.display = 'none';
                card.classList.remove('expanded');
            }
        }
    }
});

// Standalone event delegation listener for the pending sub-navigation pills
document.getElementById('pending-sub-nav')?.addEventListener('click', async (event) => {
    const pillBtn = event.target.closest('.pending-pill-btn');
    if (!pillBtn) return;

    event.preventDefault();

    // Reset all elements with class .pending-pill-btn to inactive state
    document.querySelectorAll('.pending-pill-btn').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        btn.style.color = '#a3a3ac';
    });

    // Apply active inline styles strictly to the clicked button
    pillBtn.style.background = 'rgba(255, 255, 255, 0.15)';
    pillBtn.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    pillBtn.style.color = '#ffffff';

    // Extract target status string from clicked button
    const statusString = pillBtn.getAttribute('data-status');

    // Update text content of #pending-heading based on status
    const heading = document.getElementById('pending-heading');
    if (heading) {
        if (statusString === 'pending') {
            heading.innerText = 'Pending Confirmation';
        } else if (statusString === 'admin_proposed') {
            heading.innerText = 'Sent Proposals';
        } else if (statusString === 'customer_proposed') {
            heading.innerText = 'Customer Responses';
        }
    }

    // Fetch and render filtered records
    try {
        const { data, error } = await fetchBookingsByStatus(statusString);
        if (error) throw error;
        renderPendingBookings(data);
    } catch (err) {
        Sentry.captureException(err);
        console.error("Error loading bookings by status:", err);
        showToast("Network error: Could not load bookings.");
    }
});





