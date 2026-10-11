export type FormState = {
  success: boolean;
  errors: Record<string, string>;
  values: Record<string, string>;
};

export const initialState: FormState = { success: false, errors: {}, values: {} };
