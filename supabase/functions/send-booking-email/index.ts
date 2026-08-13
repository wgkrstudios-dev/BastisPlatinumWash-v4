import nodemailer from "npm:nodemailer";
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
      .replaceAll('{{booking_date_time}}', record.booking_date_time || '')
      .replaceAll('{{proposed_date_time}}', record.booking_date_time || '')
      .replaceAll('{{vehicle_type}}', record.vehicle_type || '')
      .replaceAll('{{customer_address}}', record.customer_address || '')
      .replaceAll('{{total_price}}', String(record.total_price || '0.00'))
      .replaceAll('{{booking_id}}', record.id || '');

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: Deno.env.get('GMAIL_USER') || "",
        pass: Deno.env.get('GMAIL_PASSWORD') || "",
      },
    });

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

    const emailEnvelope = {
      from: Deno.env.get('GMAIL_USER') || "",
      to: record.customer_email,
      subject: subject,
      text: "Bastis Platinum Wash booking details update.",
      html: htmlBody,
    };

    try {
      await transporter.sendMail(emailEnvelope);
      return new Response(
        JSON.stringify({ message: "Email dispatched successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (sendErr) {
      console.error(sendErr);
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
