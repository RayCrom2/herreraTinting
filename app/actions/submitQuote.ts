"use server";
import { FormState } from "../lib/quote";
import { supabase } from "../lib/supabase/admin";

interface errorChecks {
    message: string,
    maxLength?: number,
    min?: number,
    max?: number,
}

const requiredFields: Record<string, errorChecks> = {
  firstName: {message: "Please enter your first name.", maxLength: 50},
  lastName: {message: "Please enter your last name.", maxLength: 100},
  phone: {message: "Please enter your phone number."},
  vehicleYear: {message: "Please enter your vehicle's year.", maxLength: 5, min: 1800, max: 2100},
  vehicleMake: {message: "Please enter your vehicle's make.", maxLength: 50},
  vehicleModel: {message: "Please enter your vehicle's model.", maxLength: 50},
  film: {message: "Please choose a film type."},
  windows: {message: "Please choose which windows need tint."},
  terms: {message: "Please agree to the terms to continue."},
};

export async function submitQuote(_prevState: FormState, formData: FormData): Promise<FormState> {
  const values: Record<string, string | string[]> = {};
  const errors: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (key === "windows" || key === "removalWindows" || key.startsWith("$ACTION")) continue;
    values[key] = String(value).trim();
  }
  // Checkboxes send one "windows" entry per checked box, so collect them all.
  values.windows = formData.getAll("windows").map(String);
  values.removalWindows = formData.getAll("removalWindows").map(String);
  const removalRequest = values.removalWindows.length > 0 ? "yes" : values.removalNotSure ? "not-sure" : "no";

  
  for (const [field, dict] of Object.entries(requiredFields)) {
    const value = values[field];
    if (!value?.length){
        errors[field] = dict["message"];
    }
    else if (dict["maxLength"] && (value.length > dict["maxLength"])){
        errors[field] = `Your entry was too long, please keep it to ${dict["maxLength"]} characters or fewer.`
    }
    else if (dict["min"] !== undefined && dict["max"] !== undefined){
        const num = Number(value);
        if (!Number.isInteger(num) || num < dict["min"] || num > dict["max"]){
            errors[field] = `Please enter a number between ${dict["min"]} and ${dict["max"]}.`
        }
    }
  }

  if (values["comment"] && values["comment"].length > 500){
    errors["comment"] = "Please limit your response to 500 characters."
  }

  // Keep only digits so "(707) 555-1234", "707.555.1234", "+1 707 555 1234" all normalize the same.
  let phoneDigits = String(values.phone ?? "").replace(/\D/g, "");
  if (phoneDigits.length === 11 && phoneDigits.startsWith("1")) {
    phoneDigits = phoneDigits.slice(1);
  }
  if (!errors.phone && phoneDigits.length !== 10) {
    errors.phone = "Please enter a 10-digit phone number.";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors, values };
  }

  // Map form fields to columns explicitly so extra form keys never reach the database.
    // Keys must match the SQL parameter names exactly; extra form keys never reach the database.
  const { error } = await supabase.rpc("submit_quote_request", {
    p_first_name: values.firstName,
    p_last_name: values.lastName,
    p_phone: phoneDigits,
    p_vehicle_year: Number(values.vehicleYear),
    p_vehicle_make: values.vehicleMake,
    p_vehicle_model: values.vehicleModel,
    p_source: "website",
    p_film: values.film,
    p_windows: values.windows,
    p_removal_request: removalRequest,
    p_removal_windows: values.removalWindows,
    p_comment: values.comment || null,
  });

  if (error) {
    // console.error("Failed to save quote request:", error);
    return { success: false, errors: { form: "Something went wrong, please try again." }, values };
  }

  return { success: true, errors: {}, values: {} };
}