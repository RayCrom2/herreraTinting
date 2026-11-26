import "server-only";
import twilio from "twilio";


export async function sendSms(to: string, body1: string) {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const body = "sms_appointment_reminders";
    return client.messages.create({
        body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to,
    });
}

// Stored phones are 10 US digits (see submitQuote); Twilio needs E.164.
export function toE164(tenDigits: string) {
    return `+1${tenDigits}`;
}