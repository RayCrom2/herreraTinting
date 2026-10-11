"use server";
import { FormState } from "../lib/quote";

interface errorChecks {
    message: string,
    maxLength?: number,
}

const requiredFields: Record<string, errorChecks> = {
  fullName: {message: "Please enter your full name.", maxLength: 100},
  phone: {message: "Please enter your phone number.", maxLength: 20},
  vehicle: {message: "Please enter your vehicle's year, make & model.", maxLength: 70},
  film: {message: "Please choose a film type."},
  windows: {message: "Please choose which windows need tint."},
  removal: {message: "Please let us know if you need tint removal."},
  terms: {message: "Please agree to the terms to continue."},
};

export async function submitQuote(_prevState: FormState, formData: FormData): Promise<FormState> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    values[key] = String(value).trim();
  }

  const errors: Record<string, string> = {};
  for (const [field, dict] of Object.entries(requiredFields)) {
    if (!values[field]){
        errors[field] = dict["message"];
    }
    else if (dict["maxLength"] && (values[field].length > dict["maxLength"])){
        errors[field] = `Your entry was too long, please keep it to ${dict["maxLength"]} characters or fewer.`
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors, values };
  }

  // TODO: send the quote request (server action, API route, email, etc.)
  return { success: true, errors: {}, values: {} };
}