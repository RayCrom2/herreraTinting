"use server";
import { FormState } from "../lib/quote";
import { supabase } from "../lib/supabase";

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
  removal: {message: "Please let us know if you need tint removal."},
  terms: {message: "Please agree to the terms to continue."},
};

export async function submitQuote(_prevState: FormState, formData: FormData): Promise<FormState> {
  const values: Record<string, string | string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (key !== "windows") {
      values[key] = String(value).trim();
      console.log(key, " ", value);
    }
  }
  // Checkboxes send one "windows" entry per checked box, so collect them all.
  values.windows = formData.getAll("windows").map(String);

  const errors: Record<string, string> = {};
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
  const { error } = await supabase 
  .from('quote_requests')
  .insert({
    first_name: values.firstName,
    last_name: values.lastName,
    phone: phoneDigits,
    vehicle_year: Number(values.vehicleYear),
    vehicle_make: values.vehicleMake,
    vehicle_model: values.vehicleModel,
    source: "website",
    comment: values.comment || null,
  });

  if (error) {
    // console.error("Failed to save quote request:", error);
    return { success: false, errors: { form: "Something went wrong, please try again." }, values };
  }

  return { success: true, errors: {}, values: {} };
}