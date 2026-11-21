import {
  emailTemplateConfirmed,
  emailTemplateAdminProposed,
  emailTemplateCancelled,
} from "../_shared/templates.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload?.record;

    if (!record) {
      return new Response(
        JSON.stringify({ error: "Missing record object in webhook payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { booking_status, customer_email, customer_name } = record;

    if (!booking_status) {
      return new Response(
        JSON.stringify({ error: "Missing required field: record.booking_status" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!customer_email) {
      return new Response(
        JSON.stringify({ error: "Missing required field: record.customer_email" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!customer_name) {
      return new Response(
        JSON.stringify({ error: "Missing required field: record.customer_name" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let htmlBody = "";
    let formattedDateTime = "";

    try {
      if (record.booking_date_time) {
        const dateObj = new Date(record.booking_date_time);
        if (isNaN(dateObj.getTime())) {
          throw new Error(`Invalid booking_date_time value: ${record.booking_date_time}`);
        }
        const formatter = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Africa/Johannesburg',
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        formattedDateTime = formatter.format(dateObj);
      }
    } catch (dateErr) {
      console.error("Error formatting booking_date_time:", dateErr);
      formattedDateTime = record.booking_date_time || "";
    }

    switch (record.booking_status) {
      case 'confirmed':
        htmlBody = emailTemplateConfirmed;
        break;
      case 'admin_proposed':
        htmlBody = emailTemplateAdminProposed;
        break;
      case 'cancelled':
        htmlBody = emailTemplateCancelled;
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Invalid booking status for email dispatch: ${record.booking_status}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    htmlBody = htmlBody
      .replaceAll('{{customer_name}}', record.customer_name || '')
      .replaceAll('{{booking_date_time}}', formattedDateTime || '')
      .replaceAll('{{proposed_date_time}}', formattedDateTime || '')
      .replaceAll('{{vehicle_type}}', record.vehicle_type || '')
      .replaceAll('{{customer_address}}', record.customer_address || '')
      .replaceAll('{{total_price}}', String(record.total_price || '0.00'))
      .replaceAll('{{booking_id}}', record.id || '');

    let subject = "";
    switch (record.booking_status) {
      case 'confirmed':
        subject = "Booking Confirmed - Bastis Platinum Wash";
        break;
      case 'admin_proposed':
        subject = "Action Required: New Time Proposed";
        break;
      case 'cancelled':
        subject = "Booking Cancelled - Bastis Platinum Wash";
        break;
      default:
        subject = "Booking Status Update - Bastis Platinum Wash";
        break;
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("Missing required secret: RESEND_API_KEY");
    }

    const replyToEmail = Deno.env.get("GMAIL_USER");

    const textBody = [
      subject,
      "",
      `Hi ${record.customer_name || ""},`,
      "",
      `Booking Status: ${record.booking_status}`,
      `Appointment Date & Time: ${formattedDateTime || ""}`,
      `Vehicle Type: ${record.vehicle_type || ""}`,
      `Total Price: R${String(record.total_price || '0.00')}`,
      "",
      "Visit us at: https://bpcw.co.za",
    ].join("\n");

    const resendPayload: Record<string, unknown> = {
      from: "Basti's Platinum Wash <bookings@bpcw.co.za>",
      to: [record.customer_email],
      subject: subject,
      html: htmlBody,
      text: textBody,
    };

    if (replyToEmail && replyToEmail.trim() !== "") {
      resendPayload.reply_to = replyToEmail.trim();
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resendPayload),
      });

      if (!response.ok) {
        const rawBody = await response.text();
        let errorDetails = rawBody;
        try {
          const parsedError = JSON.parse(rawBody);
          errorDetails = parsedError?.message || JSON.stringify(parsedError);
        } catch {
          // Keep raw text fallback when response body is not valid JSON
        }
        console.error("Resend API error response:", { status: response.status, body: errorDetails });
        throw new Error(`Resend API dispatch failed (${response.status}): ${errorDetails}`);
      }

      return new Response(
        JSON.stringify({ message: "Email dispatched successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (sendErr) {
      console.error("Email dispatch failed:", sendErr);
      return new Response(
        JSON.stringify({ error: sendErr instanceof Error ? sendErr.message : String(sendErr) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

  } catch (err) {
    console.error("Edge function execution failed:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
