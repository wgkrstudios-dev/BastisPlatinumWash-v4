export const emailTemplateConfirmed = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmed - Bastis Platinum Wash</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #0b0f19; padding: 40px 0;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #111827; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.3);">
          <!-- Header -->
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <h1 style="font-size: 24px; font-weight: 800; letter-spacing: 2px; color: #f8fafc; margin: 0; text-transform: uppercase;">
                Bastis <span style="color: #10b981;">Platinum</span> Wash
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <span style="display: inline-block; background-color: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; padding: 8px 16px; border-radius: 50px; border: 1px solid rgba(16, 185, 129, 0.3);">
                      Booking Confirmed
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 16px;">
                    <h2 style="font-size: 24px; font-weight: 700; color: #f8fafc; margin: 0; line-height: 1.3; text-align: center;">
                      Your wash is locked in!
                    </h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 32px;">
                    <p style="font-size: 16px; color: #94a3b8; margin: 0; line-height: 1.6; text-align: center;">
                      Hi {{customer_name}},<br><br>
                      Great news! Your booking at Bastis Platinum Wash has been successfully confirmed. Our team is ready to deliver a premium, detail-oriented wash to your vehicle.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <!-- Booking Details Card -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1f2937; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05); padding: 24px;">
                      <tr>
                        <td style="padding-bottom: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px;">Appointment Time</div>
                          <div style="font-size: 16px; color: #e2e8f0; font-weight: 600;">{{booking_date_time}}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px;">Vehicle Type</div>
                          <div style="font-size: 16px; color: #e2e8f0; font-weight: 600;">{{vehicle_type}}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px;">Service Location</div>
                          <div style="font-size: 16px; color: #e2e8f0; font-weight: 600;">{{customer_address}}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 16px;">
                          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px;">Total Price</div>
                          <div style="font-size: 20px; color: #10b981; font-weight: 700;">{{total_price}}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 32px; text-align: center;">
                    <p style="font-size: 14px; color: #64748b; margin: 0; line-height: 1.6;">
                      If you need to make changes or have any questions, please contact our support team.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #0f172a; padding: 32px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
              <p style="font-size: 14px; color: #64748b; margin: 0 0 16px 0; line-height: 1.6; text-align: center;">
                &copy; 2026 Bastis Platinum Wash. All rights reserved.<br>
                Providing premium showroom-quality care for your vehicle.
              </p>
              <div style="font-size: 12px; color: #475569; text-align: center;">
                <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 8px;">Manage Booking</a> | 
                <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 8px;">Our Services</a> | 
                <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 8px;">Contact Us</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
export const emailTemplateAdminProposed = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Time Proposed - Bastis Platinum Wash</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #0b0f19; padding: 40px 0;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #111827; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.3);">
          <!-- Header -->
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <h1 style="font-size: 24px; font-weight: 800; letter-spacing: 2px; color: #f8fafc; margin: 0; text-transform: uppercase;">
                Bastis <span style="color: #fbbf24;">Platinum</span> Wash
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <span style="display: inline-block; background-color: rgba(245, 158, 11, 0.15); color: #f59e0b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; padding: 8px 16px; border-radius: 50px; border: 1px solid rgba(245, 158, 11, 0.3);">
                      Action Required: New Time Proposed
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 16px;">
                    <h2 style="font-size: 24px; font-weight: 700; color: #f8fafc; margin: 0; line-height: 1.3; text-align: center;">
                      Proposed Schedule Adjustment
                    </h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 32px;">
                    <p style="font-size: 16px; color: #94a3b8; margin: 0; line-height: 1.6; text-align: center;">
                      Hi {{customer_name}},<br><br>
                      Our team has reviewed your booking request. To ensure we provide you with the best possible service, we have proposed a new appointment time. Please review the details below and let us know if this works for you.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <!-- Booking Details Card -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1f2937; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05); padding: 24px;">
                      <tr>
                        <td style="padding-bottom: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 6px;">Proposed Time</div>
                          <div style="font-size: 16px; color: #fbbf24; font-weight: 700;">{{proposed_date_time}}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px;">Vehicle Type</div>
                          <div style="font-size: 16px; color: #e2e8f0; font-weight: 600;">{{vehicle_type}}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px;">Service Location</div>
                          <div style="font-size: 16px; color: #e2e8f0; font-weight: 600;">{{customer_address}}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 16px;">
                          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px;">Total Price</div>
                          <div style="font-size: 20px; color: #e2e8f0; font-weight: 700;">{{total_price}}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Action Buttons -->
                <tr>
                  <td style="padding-top: 32px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding-bottom: 16px;">
                          <!-- Accept Button -->
                          <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                            <tr>
                              <td align="center" bgcolor="#10b981" style="border-radius: 8px;">
                                <a href="success.html?booking_id={{booking_id}}" target="_blank" style="display: inline-block; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; border: 1px solid #10b981;">
                                  Confirm New Booking Time
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td align="center">
                          <!-- Reject / Decline Button -->
                          <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                            <tr>
                              <td align="center" style="border-radius: 8px; border: 1px solid #ef4444;">
                                <a href="rebook.html?booking_id={{booking_id}}" target="_blank" style="display: inline-block; font-size: 16px; font-weight: 700; color: #ef4444; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                                  Propose Alternative Time
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding-top: 32px; text-align: center;">
                    <p style="font-size: 14px; color: #64748b; margin: 0; line-height: 1.6;">
                      If you decline this proposal, we will contact you to find another slot, or you can manage your request directly.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #0f172a; padding: 32px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
              <p style="font-size: 14px; color: #64748b; margin: 0 0 16px 0; line-height: 1.6; text-align: center;">
                &copy; 2026 Bastis Platinum Wash. All rights reserved.<br>
                Providing premium showroom-quality care for your vehicle.
              </p>
              <div style="font-size: 12px; color: #475569; text-align: center;">
                <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 8px;">Manage Booking</a> | 
                <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 8px;">Our Services</a> | 
                <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 8px;">Contact Us</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
export const emailTemplateCancelled = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Cancelled - Bastis Platinum Wash</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #0b0f19; padding: 40px 0;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #111827; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.3);">
          <!-- Header -->
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <h1 style="font-size: 24px; font-weight: 800; letter-spacing: 2px; color: #f8fafc; margin: 0; text-transform: uppercase;">
                Bastis <span style="color: #ef4444;">Platinum</span> Wash
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <span style="display: inline-block; background-color: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; padding: 8px 16px; border-radius: 50px; border: 1px solid rgba(239, 68, 68, 0.3);">
                      Booking Cancelled
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 16px;">
                    <h2 style="font-size: 24px; font-weight: 700; color: #f8fafc; margin: 0; line-height: 1.3; text-align: center;">
                      Your cancellation is confirmed
                    </h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 32px;">
                    <p style="font-size: 16px; color: #94a3b8; margin: 0; line-height: 1.6; text-align: center;">
                      Hi {{customer_name}},<br><br>
                      This email is to confirm that your booking at Bastis Platinum Wash has been cancelled. If this was done in error, or if you would like to book a new appointment, you can schedule another wash at any time.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <!-- Booking Details Card -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1f2937; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.05); padding: 24px;">
                      <tr>
                        <td style="padding-bottom: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px;">Cancelled Appointment Time</div>
                          <div style="font-size: 16px; color: #e2e8f0; font-weight: 600;">{{booking_date_time}}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px;">Vehicle Type</div>
                          <div style="font-size: 16px; color: #e2e8f0; font-weight: 600;">{{vehicle_type}}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 16px;">
                          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px;">Refundable Amount / Value</div>
                          <div style="font-size: 20px; color: #ef4444; font-weight: 700;">{{total_price}}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Action / Rebook Button -->
                <tr>
                  <td align="center" style="padding-top: 32px;">
                    <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" bgcolor="#1f2937" style="border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08);">
                          <a href="#" target="_blank" style="display: inline-block; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                            Book a New Wash
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding-top: 32px; text-align: center;">
                    <p style="font-size: 14px; color: #64748b; margin: 0; line-height: 1.6;">
                      If you have any questions or require support regarding refunds, please reply to this email or contact support.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #0f172a; padding: 32px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
              <p style="font-size: 14px; color: #64748b; margin: 0 0 16px 0; line-height: 1.6; text-align: center;">
                &copy; 2026 Bastis Platinum Wash. All rights reserved.<br>
                Providing premium showroom-quality care for your vehicle.
              </p>
              <div style="font-size: 12px; color: #475569; text-align: center;">
                <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 8px;">Manage Booking</a> | 
                <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 8px;">Our Services</a> | 
                <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 8px;">Contact Us</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
