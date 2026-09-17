Sentry.init({
    dsn: "https://c9c73abcccb7521e6d5c9f4b62c204a6@o4511825776279552.ingest.de.sentry.io/4511825788993616"
});

window.addEventListener('unhandledrejection', function (event) {
    Sentry.captureException(event.reason);
});

// Ensure global supabaseBackend instance is available
if (typeof supabaseBackend === 'undefined') {
    window.supabaseBackend = window.supabase;
}

// Global state for tracking incoming 'pending' bookings
let unreadCount = 0;
let currentTab = 'pending';

// Notifications State Management
const dismissedNotificationKeys = new Set();
let activeNotifications = [];

// --- Notification Renderer Functions ---

/**
 * Updates the visual notification badge counter in the admin navbar.
 * @param {number} count - Number of active notifications
 */
function updateNotificationBadge(count) {
  const badge = document.getElementById('notification-badge') || document.querySelector('#notification-icon .nav-badge');
  if (!badge) return;

  const numericCount = typeof count === 'number' ? count : activeNotifications.length;
  if (numericCount <= 0) {
    badge.textContent = '0';
    badge.style.display = 'none';
    badge.classList.remove('has-notifications');
  } else {
    badge.textContent = numericCount > 99 ? '99+' : numericCount.toString();
    badge.style.display = 'inline-flex';
    badge.classList.add('has-notifications');
  }
}

/**
 * Helper to escape HTML to prevent XSS injection from customer data.
 */
function escapeNotificationHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Renders the active notifications list inside #notification-list.
 */
function renderNotificationList() {
  const listContainer = document.getElementById('notification-list');
  if (!listContainer) return;

  if (!Array.isArray(activeNotifications) || activeNotifications.length === 0) {
    listContainer.innerHTML = '<div class="notification-empty">No new notifications</div>';
    updateNotificationBadge(0);
    return;
  }

  const itemsHTML = activeNotifications.map((item) => {
    const key = escapeNotificationHTML(item.key || '');
    const bookingId = escapeNotificationHTML(item.bookingId || '');
    const targetTab = escapeNotificationHTML(item.targetTab || 'pending');
    const subStatus = escapeNotificationHTML(item.subStatus || '');
    const text = escapeNotificationHTML(item.text || 'New notification');
    
    let timeFormatted = '';
    if (item.timestamp) {
      const d = new Date(item.timestamp);
      timeFormatted = !isNaN(d.getTime()) ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    }

    return `
      <div class="notification-item" 
           data-key="${key}" 
           data-booking-id="${bookingId}" 
           data-target-tab="${targetTab}" 
           data-sub-status="${subStatus}"
           role="button"
           tabindex="0">
        <div class="notification-item-text">${text}</div>
        ${timeFormatted ? `<div class="notification-item-time">${timeFormatted}</div>` : ''}
      </div>
    `.trim();
  }).join('');

  listContainer.innerHTML = itemsHTML;
  updateNotificationBadge(activeNotifications.length);
}

// --- Notification Intake & Template Engine ---

/**
 * Central notification intake function that formats, deduplicates, alerts, and renders incoming events.
 * @param {string} type - 'pending' | 'customer_proposed' | 'cancelled' | 'reschedule_accepted' | 'upcoming_1hr'
 * @param {Object} bookingRecord - Supabase booking record
 * @param {Object} [extraData] - Optional auxiliary data (e.g. { minutesRemaining: 45 })
 */
function handleIncomingNotification(type, bookingRecord, extraData = {}) {
  try {
    if (!bookingRecord || !bookingRecord.id) return;

    // 1. Generate unique composite key
    let key = `${type}:${bookingRecord.id}`;
    if (type === 'upcoming_1hr') {
      const scheduleTime = bookingRecord.booking_date_time || bookingRecord.date || 'scheduled';
      key = `${type}:${bookingRecord.id}:${scheduleTime}`;
    }

    // 2. Guard: verify key is not in persistent dismissal cache or already active
    if (dismissedNotificationKeys.has(key)) {
      return;
    }
    const alreadyActive = activeNotifications.some(item => item.key === key);
    if (alreadyActive) {
      return;
    }

    // 3. Resolve customer name
    const customerName = (bookingRecord.customer_name || bookingRecord.full_name || 'Customer').trim();

    // 4. Construct template text and deep-link routing targets
    let text = '';
    let targetTab = 'pending';
    let subStatus = '';

    switch (type) {
      case 'pending':
        text = `New booking received from ${customerName}`;
        targetTab = 'pending';
        break;

      case 'customer_proposed':
        text = `${customerName} has sent a proposal`;
        targetTab = 'pending';
        subStatus = 'customer_proposed';
        break;

      case 'cancelled':
        text = `booking cancelled: ${customerName}`;
        targetTab = 'cancelled';
        subStatus = '';
        break;

      case 'reschedule_accepted':
        text = `${customerName} has accepted your proposed reschedule`;
        targetTab = 'confirmed';
        break;

      case 'upcoming_1hr':
        const mins = extraData && extraData.minutesRemaining ? extraData.minutesRemaining : 60;
        text = `Heads up: booking for ${customerName} upcoming in ${mins} minutes`;
        targetTab = 'confirmed';
        break;

      default:
        text = `Update on booking for ${customerName}`;
        targetTab = 'pending';
        break;
    }

    // 5. Prepend to active notifications array
    const notificationItem = {
      key,
      bookingId: bookingRecord.id,
      targetTab,
      subStatus,
      text,
      timestamp: new Date().toISOString()
    };
    activeNotifications.unshift(notificationItem);

    // 6. Audio chime alert (with graceful autoplay policy handling)
    try {
      const chimeAudio = new Audio('assets/chime.mp3');
      chimeAudio.volume = 0.6;
      const playPromise = chimeAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay was prevented by browser policy; silently ignore
        });
      }
    } catch (audioErr) {
      // Audio not supported or missing asset; silently continue
    }

    // 7. Update UI list and badge
    if (typeof renderNotificationList === 'function') {
      renderNotificationList();
    }
  } catch (err) {
    console.error('Error handling incoming notification:', err);
    if (window.Sentry && typeof window.Sentry.captureException === 'function') {
      window.Sentry.captureException(err);
    }
  }
}

// --- Supabase Realtime Subscription Manager ---
let realtimeBookingsChannel = null;

/**
 * Tears down any active Supabase Realtime channel to prevent duplicate event delivery.
 */
function teardownRealtimeBookingsSubscription() {
  try {
    if (realtimeBookingsChannel && typeof supabaseBackend.removeChannel === 'function') {
      supabaseBackend.removeChannel(realtimeBookingsChannel);
      realtimeBookingsChannel = null;
    }
  } catch (err) {
    console.error('Error tearing down realtime bookings channel:', err);
    if (window.Sentry && typeof window.Sentry.captureException === 'function') {
      window.Sentry.captureException(err);
    }
  }
}

/**
 * Establishes a centralized Supabase Realtime subscription for INSERT and UPDATE on public:bookings.
 */
function setupRealtimeBookingsSubscription() {
  try {
    // 1. Clean up any existing channel before subscribing
    teardownRealtimeBookingsSubscription();

    realtimeBookingsChannel = supabaseBackend
      .channel('public:bookings-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings' },
        (payload) => {
          try {
            if (payload && payload.new) {
              handleIncomingNotification('pending', payload.new);
              // Also refresh current tab view if applicable
              if (typeof fetchBookingsByStatus === 'function' && currentTab === 'pending') {
                fetchBookingsByStatus('pending');
              }
            }
          } catch (insertErr) {
            console.error('Error handling realtime INSERT event:', insertErr);
            if (window.Sentry && typeof window.Sentry.captureException === 'function') {
              window.Sentry.captureException(insertErr);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings' },
        (payload) => {
          try {
            if (!payload || !payload.new) return;
            const newRecord = payload.new;
            const oldRecord = payload.old || {};

            // A. Customer sent a proposal
            if (newRecord.booking_status === 'customer_proposed' || newRecord.status === 'customer_proposed') {
              handleIncomingNotification('customer_proposed', newRecord);
            }
            // B. Customer accepted a reschedule proposal
            else if (
              (newRecord.booking_status === 'confirmed' || newRecord.status === 'confirmed') &&
              (oldRecord.booking_status === 'proposed' || oldRecord.booking_status === 'customer_proposed' || newRecord.reschedule_accepted === true)
            ) {
              handleIncomingNotification('reschedule_accepted', newRecord);
            }
            // C. Booking cancelled
            else if (
              (newRecord.booking_status === 'cancelled' || newRecord.status === 'cancelled') &&
              oldRecord.booking_status !== 'cancelled'
            ) {
              handleIncomingNotification('cancelled', newRecord);
            }

            // Refresh the current view to reflect data updates
            if (typeof fetchBookingsByStatus === 'function' && typeof currentTab === 'string') {
              fetchBookingsByStatus(currentTab);
            }
          } catch (updateErr) {
            console.error('Error handling realtime UPDATE event:', updateErr);
            if (window.Sentry && typeof window.Sentry.captureException === 'function') {
              window.Sentry.captureException(updateErr);
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error('Realtime subscription error:', err);
          if (window.Sentry && typeof window.Sentry.captureException === 'function') {
            window.Sentry.captureException(err);
          }
        }
      });
  } catch (err) {
    console.error('Failed to initialize realtime bookings channel:', err);
    if (window.Sentry && typeof window.Sentry.captureException === 'function') {
      window.Sentry.captureException(err);
    }
  }
}

// --- Confirmed Bookings 60-Minute Upcoming Polling Worker ---
let upcomingBookingsInterval = null;

/**
 * Background worker that queries today's confirmed bookings and alerts if scheduled within 60 minutes.
 */
async function checkUpcomingConfirmedBookings() {
  try {
    if (!supabaseBackend) return;

    // Get today's start and end boundaries in local ISO format (YYYY-MM-DD)
    const now = new Date();
    const todayDateStr = now.toISOString().split('T')[0];

    // Query confirmed bookings for today
    const { data: bookings, error } = await supabaseBackend
      .from('bookings')
      .select('*')
      .eq('booking_status', 'confirmed');

    if (error) {
      console.error('Error polling upcoming confirmed bookings:', error);
      if (window.Sentry && typeof window.Sentry.captureException === 'function') {
        window.Sentry.captureException(error);
      }
      return;
    }

    if (!Array.isArray(bookings) || bookings.length === 0) return;

    const currentTimeMs = now.getTime();

    bookings.forEach((booking) => {
      try {
        // Resolve timestamp from booking_date_time or combined booking_date / booking_time
        let scheduledDate = null;
        if (booking.booking_date_time) {
          scheduledDate = new Date(booking.booking_date_time);
        } else if (booking.booking_date && booking.booking_time) {
          scheduledDate = new Date(`${booking.booking_date}T${booking.booking_time}`);
        } else if (booking.date && booking.time) {
          scheduledDate = new Date(`${booking.date}T${booking.time}`);
        }

        if (!scheduledDate || isNaN(scheduledDate.getTime())) return;

        // Calculate delta in minutes: (booking_date_time - now) / 60000
        const deltaMs = scheduledDate.getTime() - currentTimeMs;
        const deltaMinutes = Math.round(deltaMs / 60000);

        // Alert condition: between 1 and 60 minutes remaining
        if (deltaMinutes > 0 && deltaMinutes <= 60) {
          handleIncomingNotification('upcoming_1hr', booking, { minutesRemaining: deltaMinutes });
        }
      } catch (itemErr) {
        console.error('Error calculating time for booking record:', itemErr);
      }
    });
  } catch (err) {
    console.error('Unexpected error in checkUpcomingConfirmedBookings worker:', err);
    if (window.Sentry && typeof window.Sentry.captureException === 'function') {
      window.Sentry.captureException(err);
    }
  }
}

/**
 * Starts the 60-second polling worker for upcoming confirmed bookings.
 */
function startUpcomingBookingsWorker() {
  stopUpcomingBookingsWorker();
  checkUpcomingConfirmedBookings(); // Run initial check immediately
  upcomingBookingsInterval = setInterval(checkUpcomingConfirmedBookings, 60000);
}

/**
 * Stops the upcoming bookings polling worker.
 */
function stopUpcomingBookingsWorker() {
  if (upcomingBookingsInterval) {
    clearInterval(upcomingBookingsInterval);
    upcomingBookingsInterval = null;
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

            await loadDismissedNotificationKeys();
            await reconstructActionableNotifications();

            // Automatically fetch and render the initial pending bookings
            const { data: pendingData, error: pendingError } = await fetchBookingsByStatus('pending');
            if (!pendingError && pendingData) {
                renderPendingBookings(pendingData);
            }

            // Sync badge directly with active notifications state
            updateNotificationBadge(activeNotifications.length);

            // Establish the Realtime channel subscription for the restored session
            setupRealtimeBookingsSubscription();
            startUpcomingBookingsWorker();
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

        await loadDismissedNotificationKeys();
        await reconstructActionableNotifications();

        try {
            updateNotificationBadge(activeNotifications.length);
            setupRealtimeBookingsSubscription();
            startUpcomingBookingsWorker();
        } catch (err) {
            console.error("Error initializing realtime notification listeners:", err);
            if (window.Sentry && typeof window.Sentry.captureException === 'function') {
                window.Sentry.captureException(err);
            }
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
        teardownRealtimeBookingsSubscription();
        stopUpcomingBookingsWorker();
        await supabase.auth.signOut();
        document.getElementById('dashboard-container').style.display = 'none';
        document.getElementById('login-container').style.display = 'block';
    } catch (error) {
        console.error("Logout Error:", error.message || error);
    }
});

// --- Notification Dropdown Toggle & Outside Click Handlers ---
const notificationIcon = document.getElementById('notification-icon');
const notificationDropdown = document.getElementById('notification-dropdown');

if (notificationIcon && notificationDropdown) {
  notificationIcon.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = notificationDropdown.classList.toggle('active');
    notificationDropdown.classList.toggle('open', isOpen);
    notificationIcon.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Prevent clicks inside the dropdown from bubbling to document and auto-closing
  notificationDropdown.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  // Auto-collapse dropdown when tapping outside
  document.addEventListener('click', (event) => {
    if (notificationDropdown.classList.contains('active') || notificationDropdown.classList.contains('open')) {
      if (!notificationDropdown.contains(event.target) && !notificationIcon.contains(event.target)) {
        notificationDropdown.classList.remove('active', 'open');
        notificationIcon.setAttribute('aria-expanded', 'false');
      }
    }
  });
}


/**
 * Initializes click delegation on the notification list for deep-linking into booking cards.
 */
function setupNotificationItemClickDelegation() {
  const listContainer = document.getElementById('notification-list');
  if (!listContainer) return;

  listContainer.addEventListener('click', async (event) => {
    const item = event.target.closest('.notification-item');
    if (!item || item.classList.contains('dismissing-right') || item.classList.contains('swiping')) return;

    try {
      const key = item.getAttribute('data-key');
      const bookingId = item.getAttribute('data-booking-id');
      const targetTab = item.getAttribute('data-target-tab') || 'pending';
      const subStatus = item.getAttribute('data-sub-status') || '';

      // 1. Roll-up & collapse dropdown immediately
      const dropdown = document.getElementById('notification-dropdown');
      const icon = document.getElementById('notification-icon');
      if (dropdown) dropdown.classList.remove('active', 'open');
      if (icon) icon.setAttribute('aria-expanded', 'false');

      // 2. Remove from active notifications array and re-render
      if (key) {
        activeNotifications = activeNotifications.filter(n => n.key !== key);
        if (typeof renderNotificationList === 'function') {
          renderNotificationList();
        }
        // 3. Persist dismissal to database
        if (typeof persistNotificationDismissal === 'function') {
          persistNotificationDismissal(key);
        }
      }

      if (!bookingId) return;

      // 4. Programmatically activate the target tab and wait for data render
      await activateAdminTab('view-' + targetTab);

      // 5. If sub-status specified, activate sub-navigation filter pill and wait for data render
      if (subStatus) {
        await activateSubStatusPill(subStatus);
      }

      // 6. Locate the rendered booking card synchronously
      const cardSelector = `.booking-card[data-id="${bookingId}"], .booking-card[data-booking-id="${bookingId}"]`;
      const card = document.querySelector(cardSelector);

      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Apply a visual highlight pulse
        card.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
        card.style.boxShadow = '0 0 0 2px #3b82f6, 0 10px 25px rgba(59, 130, 246, 0.3)';
        card.style.transform = 'scale(1.02)';
        setTimeout(() => {
          card.style.boxShadow = '';
          card.style.transform = '';
        }, 2000);

        // Expand card into View B if not already expanded
        if (typeof openBookingDetails === 'function') {
          openBookingDetails(bookingId);
        } else {
          // Trigger click on expand action button or card body
          const expandTrigger = card.querySelector('.btn-expand, .card-header, .view-details-btn, .view-a') || card;
          if (expandTrigger && typeof expandTrigger.click === 'function') {
            expandTrigger.click();
          }
        }
      } else {
        console.warn(`Booking card for ID ${bookingId} not found after tab switch.`);
      }
    } catch (err) {
      console.error('Error handling notification item selection deep linking:', err);
      if (window.Sentry && typeof window.Sentry.captureException === 'function') {
        window.Sentry.captureException(err);
      }
    }
  });
}

// Wire notification item click delegation
setupNotificationItemClickDelegation();

// --- Notification Touch Swipe-to-Dismiss Gestures ---

/**
 * Attaches touch event delegation to the notification list to enable swipe-to-dismiss gestures.
 */
function setupNotificationSwipeGestures() {
  const listContainer = document.getElementById('notification-list');
  if (!listContainer) return;

  let currentItem = null;
  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let isSwiping = false;

  listContainer.addEventListener('touchstart', (e) => {
    const item = e.target.closest('.notification-item');
    if (!item) return;

    currentItem = item;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    deltaX = 0;
    isSwiping = false;
  }, { passive: true });

  listContainer.addEventListener('touchmove', (e) => {
    if (!currentItem) return;

    const moveX = e.touches[0].clientX;
    const moveY = e.touches[0].clientY;
    const diffX = moveX - startX;
    const diffY = moveY - startY;

    // Detect horizontal swipe intent (rightward only)
    if (!isSwiping) {
      if (diffX > 15 && Math.abs(diffX) > Math.abs(diffY)) {
        isSwiping = true;
        currentItem.classList.add('swiping');
      }
    }

    if (isSwiping) {
      // Prevent browser default pull-to-refresh or page scroll
      if (e.cancelable) e.preventDefault();

      deltaX = Math.max(0, diffX); // Clamp so left-swiping doesn't invert
      currentItem.style.transform = `translateX(${deltaX}px)`;
      currentItem.style.opacity = `${Math.max(0.15, 1 - (deltaX / 260))}`;
    }
  }, { passive: false });

  const handleTouchEndOrCancel = () => {
    if (!currentItem) return;

    const item = currentItem;
    const thresholdReached = isSwiping && deltaX >= 80;

    item.classList.remove('swiping');
    currentItem = null;
    isSwiping = false;

    if (thresholdReached) {
      // Trigger CSS dismissal animation
      item.style.setProperty('--swipe-x', `${deltaX}px`);
      item.style.setProperty('--swipe-opacity', item.style.opacity);
      item.classList.add('dismissing-right');

      // Extract dismissal identifier
      const notificationKey = item.getAttribute('data-key') || item.dataset?.key;

      // 2. Wait for animation completion (250ms), then purge and persist
      setTimeout(() => {
        const key = notificationKey;
        if (key) {
          activeNotifications = activeNotifications.filter(n => n.key !== key);
          if (typeof renderNotificationList === 'function') {
            renderNotificationList();
          }
          if (typeof persistNotificationDismissal === 'function') {
            persistNotificationDismissal(key);
          }
        }
      }, 250);
    } else {
      // Snapback to original position
      item.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
      item.style.transform = '';
      item.style.opacity = '';
      setTimeout(() => {
        if (item) item.style.transition = '';
      }, 200);
    }
  };

  listContainer.addEventListener('touchend', handleTouchEndOrCancel, { passive: true });
  listContainer.addEventListener('touchcancel', handleTouchEndOrCancel, { passive: true });
}

// Wire notification swipe gestures
setupNotificationSwipeGestures();

/**
 * Fetches previously dismissed notification keys from Supabase and populates the in-memory Set.
 */
async function loadDismissedNotificationKeys() {
  try {
    const { data, error } = await supabaseBackend
      .from('admin_notification_dismissals')
      .select('notification_key');

    if (error) {
      console.error('Error fetching dismissed notifications from Supabase:', error);
      if (window.Sentry && typeof window.Sentry.captureException === 'function') {
        window.Sentry.captureException(error);
      }
      return;
    }

    if (Array.isArray(data)) {
      dismissedNotificationKeys.clear();
      data.forEach(item => {
        if (item.notification_key) {
          dismissedNotificationKeys.add(item.notification_key);
        }
      });
    }
  } catch (err) {
    console.error('Unexpected exception in loadDismissedNotificationKeys:', err);
    if (window.Sentry && typeof window.Sentry.captureException === 'function') {
      window.Sentry.captureException(err);
    }
  }
}

/**
 * Reconstructs actionable notifications from bookings in Supabase.
 */
async function reconstructActionableNotifications() {
  try {
    const { data, error } = await supabaseBackend
      .from('bookings')
      .select('*')
      .in('booking_status', ['pending', 'customer_proposed', 'cancelled', 'confirmed'])
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const bookings = data || [];
    for (const booking of bookings) {
      let type;
      if (booking.booking_status === 'pending') {
        type = 'pending';
      } else if (booking.booking_status === 'customer_proposed') {
        type = 'customer_proposed';
      } else if (booking.booking_status === 'cancelled') {
        type = 'cancelled';
      } else if (booking.booking_status === 'confirmed' && booking.reschedule_accepted === true) {
        type = 'reschedule_accepted';
      } else {
        continue;
      }

      const key = `${type}:${booking.id}`;

      if (dismissedNotificationKeys.has(key)) {
        continue;
      }

      if (activeNotifications.some(n => n.key === key)) {
        continue;
      }

      const customerName = booking.customer_name || booking.customer_email || 'Customer';

      let text = '';
      let targetTab = '';
      let subStatus = '';

      if (type === 'pending') {
        text = `New booking from ${customerName}`;
        targetTab = 'pending';
        subStatus = '';
      } else if (type === 'customer_proposed') {
        text = `${customerName} proposed a new time`;
        targetTab = 'pending';
        subStatus = 'customer_proposed';
      } else if (type === 'cancelled') {
        text = `Booking cancelled by ${customerName}`;
        targetTab = 'cancelled';
        subStatus = '';
      } else if (type === 'reschedule_accepted') {
        text = `${customerName} accepted your reschedule`;
        targetTab = 'confirmed';
        subStatus = '';
      }

      const notification = {
        key: key,
        bookingId: booking.id,
        targetTab: targetTab,
        subStatus: subStatus,
        text: text,
        timestamp: booking.updated_at || booking.created_at || new Date().toISOString()
      };

      activeNotifications.unshift(notification);
    }

    renderNotificationList();
    updateNotificationBadge(activeNotifications.length);
  } catch (err) {
    if (typeof Sentry !== 'undefined' && Sentry.captureException) {
      Sentry.captureException(err);
    } else {
      console.error('Error reconstructing notifications:', err);
    }
  }
}

// --- Notification Dismissal Persistence Helper ---

/**
 * Persists a dismissed notification key to local memory and Supabase database.
 * @param {string} notificationKey - The composite key identifying the dismissed notification
 * @returns {Promise<boolean>} - True if saved successfully, false otherwise
 */
async function persistNotificationDismissal(notificationKey) {
  if (!notificationKey || typeof notificationKey !== 'string') {
    return false;
  }

  try {
    // 1. Update in-memory cache immediately
    dismissedNotificationKeys.add(notificationKey);

    if (!supabaseBackend) {
      console.warn('Supabase client not initialized; saved dismissal only to in-memory cache.');
      return true;
    }

    // 2. Persist to Supabase table
    const { error } = await supabaseBackend
      .from('admin_notification_dismissals')
      .insert([{ notification_key: notificationKey }]);

    if (error) {
      // If code 23505 (unique violation), it was already dismissed; treat as success
      if (error.code === '23505') {
        return true;
      }
      console.error('Failed to persist notification dismissal to Supabase:', error);
      if (window.Sentry && typeof window.Sentry.captureException === 'function') {
        window.Sentry.captureException(error);
      }
      return false;
    }

    return true;
  } catch (err) {
    console.error('Unexpected exception in persistNotificationDismissal:', err);
    if (window.Sentry && typeof window.Sentry.captureException === 'function') {
      window.Sentry.captureException(err);
    }
    return false;
  }
}

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

// Standalone Tab Activation Function
async function activateAdminTab(targetId) {
    if (!targetId) return;
    const button = document.querySelector(`button[data-target="${targetId}"]`);
    currentTab = targetId.replace('view-', '');
    
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
    
    // Add active class to target button and section, and set active inline styles
    if (button) {
        button.classList.add('active');
        button.style.background = 'rgba(255, 255, 255, 0.1)';
        button.style.color = '#fff';
    }
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
            if (window.Sentry) {
                Sentry.captureException(err);
            }
            showToast("Network error: Could not load pending bookings.");
        }
    } else if (targetId === 'view-confirmed') {
        try {
            const { data, error } = await fetchBookingsByStatus('confirmed');
            if (error) throw error;
            renderConfirmedBookings(data);
        } catch (err) {
            console.error("Error loading confirmed bookings:", err);
            if (window.Sentry) {
                Sentry.captureException(err);
            }
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
            if (window.Sentry) {
                Sentry.captureException(err);
            }
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
            if (window.Sentry) {
                Sentry.captureException(err);
            }
            showToast("Network error: Could not load cancelled bookings.");
        }
    }
}

// Universal Tab-Switching Controller
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', async () => {
        const targetId = button.getAttribute('data-target');
        await activateAdminTab(targetId);
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
 * Generates the HTML markup for vehicle type icons in View A of booking cards.
 * Supports explicit multi-vehicle numeric quantities (hatchback_qty / suv_qty)
 * with a fallback parser for legacy vehicle_type strings.
 *
 * @param {Object} booking - The booking record from Supabase.
 * @returns {string} HTML string containing vehicle icon(s) or fallback label.
 */
function getVehicleIconsHTML(booking) {
    try {
        if (!booking || typeof booking !== 'object') {
            return '<span class="admin-vehicle-icons"><span class="vehicle-type">N/A</span></span>';
        }

        let hasHatchback = false;
        let hasSuv = false;

        const hasHatchQty = booking.hatchback_qty != null && !isNaN(Number(booking.hatchback_qty));
        const hasSuvQty = booking.suv_qty != null && !isNaN(Number(booking.suv_qty));

        // Check explicit numeric quantities first
        if (hasHatchQty || hasSuvQty) {
            hasHatchback = Number(booking.hatchback_qty) > 0;
            hasSuv = Number(booking.suv_qty) > 0;
        } else {
            // Legacy Fallback: Inspect booking.vehicle_type string
            const vehicleTypeStr = String(booking.vehicle_type || '').toLowerCase();
            if (vehicleTypeStr.includes('hatchback') || vehicleTypeStr.includes('sedan')) {
                hasHatchback = true;
            }
            if (vehicleTypeStr.includes('suv') || vehicleTypeStr.includes('bakkie') || vehicleTypeStr.includes('4x4')) {
                hasSuv = true;
            }
        }

        const hatchbackImg = '<img class="admin-vehicle-icon" src="assets/hatchbackandsedan-buttonlogo.png" alt="Hatchback & Sedan" title="Hatchback & Sedan">';
        const suvImg = '<img class="admin-vehicle-icon" src="assets/suvandbakkie-buttonlogo.png" alt="SUV & Bakkie" title="SUV & Bakkie">';

        if (hasHatchback && hasSuv) {
            return `<span class="admin-vehicle-icons">${hatchbackImg}${suvImg}</span>`;
        } else if (hasHatchback) {
            return `<span class="admin-vehicle-icons">${hatchbackImg}</span>`;
        } else if (hasSuv) {
            return `<span class="admin-vehicle-icons">${suvImg}</span>`;
        } else {
            return `<span class="admin-vehicle-icons"><span class="vehicle-type">${booking.vehicle_type || 'N/A'}</span></span>`;
        }
    } catch (err) {
        console.error('Error generating vehicle icons HTML:', err);
        return `<span class="admin-vehicle-icons"><span class="vehicle-type">${(booking && booking.vehicle_type) || 'N/A'}</span></span>`;
    }
}

/**
 * Generates the HTML markup for the vehicle quantity breakdown in View B.
 * Displays counts for Hatchback & Sedan and SUV & Bakkie, with fallback parsing
 * for legacy records where explicit quantity columns are null/undefined.
 *
 * @param {Object} booking - The booking record from Supabase.
 * @returns {string} HTML paragraph elements displaying vehicle breakdown.
 */
function getVehicleBreakdownHTML(booking) {
    try {
        if (!booking || typeof booking !== 'object') {
            return '<p><strong>Hatchback & Sedan:</strong> 0</p><p><strong>SUV & Bakkie:</strong> 0</p>';
        }

        let hatchbackCount = 0;
        let suvCount = 0;

        const hasExplicitHatchback = booking.hatchback_qty !== null && booking.hatchback_qty !== undefined;
        const hasExplicitSuv = booking.suv_qty !== null && booking.suv_qty !== undefined;

        if (hasExplicitHatchback || hasExplicitSuv) {
            hatchbackCount = Number(booking.hatchback_qty) || 0;
            suvCount = Number(booking.suv_qty) || 0;
        } else {
            const vehicleTypeStr = String(booking.vehicle_type || '');

            if (/hatchback|sedan/i.test(vehicleTypeStr)) {
                const match = vehicleTypeStr.match(/(\d+)\s*x\s*[^,]*?(?:hatchback|sedan)/i);
                hatchbackCount = match ? (parseInt(match[1], 10) || 1) : 1;
            }

            if (/suv|bakkie|4x4/i.test(vehicleTypeStr)) {
                const match = vehicleTypeStr.match(/(\d+)\s*x\s*[^,]*?(?:suv|bakkie|4x4)/i);
                suvCount = match ? (parseInt(match[1], 10) || 1) : 1;
            }
        }

        return `<p><strong>Hatchback & Sedan:</strong> ${hatchbackCount}</p><p><strong>SUV & Bakkie:</strong> ${suvCount}</p>`;
    } catch (err) {
        console.error('Error generating vehicle breakdown HTML:', err);
        return '<p><strong>Hatchback & Sedan:</strong> 0</p><p><strong>SUV & Bakkie:</strong> 0</p>';
    }
}

/**
 * Render pending bookings cards inside the pending tab section.
 * @param {Array<Object>} data - Array of booking objects from Supabase.
 */
function renderPendingBookings(data) {
    try {
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
                        ${getVehicleIconsHTML(booking)}
                    </div>
                    <div class="booking-time">${formattedDate}</div>
                </div>
                <div class="view-b" style="display: none;">
                    <div class="details-grid">
                        <p><strong>Phone:</strong> ${booking.customer_phone || 'N/A'}</p>
                        <p><strong>Email:</strong> ${booking.customer_email || 'N/A'}</p>
                        <p><strong>Address:</strong> ${booking.customer_address || 'N/A'}</p>
                        ${getVehicleBreakdownHTML(booking)}
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
    } catch (error) {
        if (typeof Sentry !== 'undefined') {
            Sentry.captureException(error);
        }
        console.error('Error rendering pending bookings:', error);
    }
}

/**
 * Render confirmed bookings cards inside the confirmed tab section.
 * @param {Array<Object>} data - Array of booking objects from Supabase.
 */
function renderConfirmedBookings(data) {
    try {
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
                        ${getVehicleIconsHTML(booking)}
                    </div>
                    <div class="booking-time">${formattedDate}</div>
                </div>
                <div class="view-b" style="display: none;">
                    <div class="details-grid">
                        <p><strong>Phone:</strong> ${booking.customer_phone || 'N/A'}</p>
                        <p><strong>Email:</strong> ${booking.customer_email || 'N/A'}</p>
                        <p><strong>Address:</strong> ${booking.customer_address || 'N/A'}</p>
                        ${getVehicleBreakdownHTML(booking)}
                        <p><strong>Total Price:</strong> R${booking.total_price || '0.00'}</p>
                    </div>
                    <div class="action-buttons">
                        <button class="btn-complete btn-confirm">Booking Completed</button>
                        <button class="btn-propose">Propose Time</button>
                        <a href="tel:${booking.customer_phone || ''}" class="btn-call" style="display: flex; align-items: center; justify-content: center; text-decoration: none; text-align: center; flex: 1; min-height: 44px; box-sizing: border-box; border-radius: var(--border-radius-md); font-size: 0.85rem; font-weight: 600; font-family: var(--font-family);">Call Customer</a>
                        <button class="btn-cancel">Cancel</button>
                    </div>
                </div>
            `;

            section.appendChild(card);
        });
    } catch (error) {
        if (typeof Sentry !== 'undefined') {
            Sentry.captureException(error);
        }
        console.error('Error rendering confirmed bookings:', error);
    }
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

        const confirmedData = await fetchBookingsByStatus('confirmed');
        renderConfirmedBookings(confirmedData.data);
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

// Standalone event listener for Cancel Action on #view-confirmed
document.getElementById('view-confirmed')?.addEventListener('click', async (event) => {
    const btnCancel = event.target.closest('.btn-cancel');
    if (!btnCancel) return;

    const card = event.target.closest('.booking-card');
    if (!card) return;
    const bookingId = card.getAttribute('data-id');
    if (!bookingId) return;

    // UI Interaction State
    btnCancel.disabled = true;
    btnCancel.innerText = 'Cancelling...';

    // Ensure supabaseClient is available
    if (typeof supabaseClient === 'undefined') {
        window.supabaseClient = typeof supabaseBackend !== 'undefined' ? supabaseBackend : window.supabase;
    }

    try {
        const { error } = await supabaseClient
            .from('bookings')
            .update({ booking_status: 'cancelled' })
            .eq('id', bookingId);

        if (error) throw error;

        showToast('Booking cancelled.', 'success');

        const confirmedData = await fetchBookingsByStatus('confirmed');
        renderConfirmedBookings(confirmedData.data);

        const cancelledData = await fetchBookingsByStatus('cancelled');
        renderCancelledBookings(cancelledData.data);
    } catch (err) {
        if (typeof Sentry !== 'undefined') {
            Sentry.captureException(err);
        }
        console.error('Error cancelling confirmed booking:', err);
        showToast('Failed to cancel booking. Please try again.', 'error');
        btnCancel.disabled = false;
        btnCancel.innerText = 'Cancel';
    }
});

// Standalone event listener for Propose Time Action on #view-confirmed
document.getElementById('view-confirmed')?.addEventListener('click', (e) => {
    const btnPropose = e.target.closest('.btn-propose');
    if (!btnPropose) return;

    const card = e.target.closest('.booking-card');
    if (!card) return;
    const bookingId = card.getAttribute('data-id');
    if (!bookingId) return;

    activeBookingIdForProposal = bookingId;

    const dateInput = document.getElementById('ptbm-date');
    const timeInput = document.getElementById('ptbm-time');
    const messageInput = document.getElementById('ptbm-message');
    const overlay = document.getElementById('ptbm-overlay');

    const timeEl = card.querySelector('.booking-time');
    if (timeEl && dateInput && timeInput) {
        try {
            const rawText = timeEl.innerText || '';
            let datePart = '';
            let timePart = '';

            if (rawText.includes(' at ')) {
                const parts = rawText.split(' at ');
                datePart = parts[0];
                timePart = parts[1] || '';
            } else if (rawText.includes(',')) {
                const parts = rawText.split(',');
                datePart = parts[0];
                timePart = parts[1] || '';
            } else {
                datePart = rawText;
            }

            const dateSegment = datePart.replace('Booking Time:', '').trim();
            const timeSegment = timePart.trim();

            const d = new Date(dateSegment);
            if (!isNaN(d.getTime())) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                dateInput.value = `${year}-${month}-${day}`;
            }

            const timePattern = /^([01]\d|2[0-3]):?([0-5]\d)$/;
            if (timePattern.test(timeSegment)) {
                timeInput.value = timeSegment;
            }
        } catch (parseErr) {
            if (typeof Sentry !== 'undefined') {
                Sentry.captureException(parseErr);
            }
            console.warn('Failed to parse booking time:', parseErr);
        }
    }

    if (messageInput) {
        messageInput.value = '';
    }

    if (overlay) {
        overlay.style.display = 'flex';
        overlay.classList.remove('hidden');
        setTimeout(() => {
            overlay.classList.add('active');
        }, 10);
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
    try {
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
                        ${getVehicleIconsHTML(booking)}
                    </div>
                    <div class="booking-time">${formattedDate}</div>
                </div>
                <div class="view-b" style="display: none;">
                    <div class="details-grid">
                        <p><strong>Phone:</strong> ${booking.customer_phone || 'N/A'}</p>
                        <p><strong>Email:</strong> ${booking.customer_email || 'N/A'}</p>
                        <p><strong>Address:</strong> ${booking.customer_address || 'N/A'}</p>
                        ${getVehicleBreakdownHTML(booking)}
                        <p><strong>Total Price:</strong> R${booking.total_price || '0.00'}</p>
                    </div>
                </div>
            `;

            container.appendChild(card);
        });
    } catch (error) {
        if (typeof Sentry !== 'undefined') {
            Sentry.captureException(error);
        }
        console.error('Error rendering completed bookings:', error);
    }
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
    try {
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
                        ${getVehicleIconsHTML(booking)}
                    </div>
                    <div class="booking-time">${formattedDate}</div>
                </div>
                <div class="view-b" style="display: none;">
                    <div class="details-grid">
                        <p><strong>Phone:</strong> ${booking.customer_phone || 'N/A'}</p>
                        <p><strong>Email:</strong> ${booking.customer_email || 'N/A'}</p>
                        <p><strong>Address:</strong> ${booking.customer_address || 'N/A'}</p>
                        ${getVehicleBreakdownHTML(booking)}
                        <p><strong>Total Price:</strong> R${booking.total_price || '0.00'}</p>
                    </div>
                </div>
            `;

            container.appendChild(card);
        });
    } catch (error) {
        if (typeof Sentry !== 'undefined') {
            Sentry.captureException(error);
        }
        console.error('Error rendering cancelled bookings:', error);
    }
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

// Standalone Sub-Status Pill Activation Function
async function activateSubStatusPill(statusString) {
    if (!statusString) return;

    const pillBtn = document.querySelector(`.pending-pill-btn[data-status="${statusString}"]`);

    // Reset all elements with class .pending-pill-btn to inactive state
    document.querySelectorAll('.pending-pill-btn').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        btn.style.color = '#a3a3ac';
    });

    // Apply active inline styles strictly to the target button
    if (pillBtn) {
        pillBtn.style.background = 'rgba(255, 255, 255, 0.15)';
        pillBtn.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        pillBtn.style.color = '#ffffff';
    }

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
        if (window.Sentry) {
            Sentry.captureException(err);
        }
        console.error("Error loading bookings by status:", err);
        showToast("Network error: Could not load bookings.");
    }
}

// Standalone event delegation listener for the pending sub-navigation pills
document.getElementById('pending-sub-nav')?.addEventListener('click', async (event) => {
    const pillBtn = event.target.closest('.pending-pill-btn');
    if (!pillBtn) return;

    event.preventDefault();
    await activateSubStatusPill(pillBtn.getAttribute('data-status'));
});





