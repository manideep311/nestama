"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { addressInputSchema, firstFieldErrors, INDIAN_STATES, type AddressDTO, type AddressInput } from "@nestama/shared";
import { useSaveAddress } from "@/lib/account-client";
import { ApiRequestError } from "@/lib/cart-client";
import { Button } from "@/components/ui/Button";
import { FormAlert, SelectField, TextField } from "@/components/ui/Field";

type Fields = Required<Omit<AddressInput, "isDefault">>;
type FieldErrors = Partial<Record<keyof Fields, string>>;

function fromAddress(a?: AddressDTO): Fields {
  return {
    fullName: a?.fullName ?? "",
    phone: a?.phone ?? "",
    line1: a?.line1 ?? "",
    line2: a?.line2 ?? "",
    landmark: a?.landmark ?? "",
    city: a?.city ?? "",
    state: a?.state ?? "",
    pincode: a?.pincode ?? "",
  } as Fields;
}

/**
 * Add / edit a delivery address. Validates with the same Zod schema the API uses, so messages
 * match and nothing invalid is ever sent.
 */
export function AddressForm({
  address,
  defaultChecked = false,
  submitLabel = "Save address",
  onSaved,
  onCancel,
}: {
  address?: AddressDTO;
  defaultChecked?: boolean;
  submitLabel?: string;
  onSaved: (address: AddressDTO) => void;
  onCancel?: () => void;
}) {
  const save = useSaveAddress();
  const [fields, setFields] = useState<Fields>(() => fromAddress(address));
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? defaultChecked);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = (key: keyof Fields) => (e: { target: { value: string } }) => setFields((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = addressInputSchema.safeParse({ ...fields, isDefault });
    if (!parsed.success) {
      setErrors(firstFieldErrors(parsed.error) as FieldErrors);
      return;
    }
    setErrors({});
    setFormError(null);
    save.mutate(
      { id: address?.id, data: { ...fields, isDefault } },
      {
        onSuccess: onSaved,
        onError: (err) => setFormError(err instanceof ApiRequestError ? err.message : "We couldn't save that address. Please try again."),
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      {formError && <FormAlert className="sm:col-span-2">{formError}</FormAlert>}
      <TextField
        label="Full name"
        autoComplete="name"
        value={fields.fullName}
        onChange={set("fullName")}
        error={errors.fullName}
        maxLength={80}
      />
      <TextField
        label="Mobile number"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={fields.phone}
        onChange={set("phone")}
        error={errors.phone}
        hint="For delivery updates. 10 digits."
        maxLength={16}
      />
      <TextField
        label="Flat, house no., building"
        autoComplete="address-line1"
        value={fields.line1}
        onChange={set("line1")}
        error={errors.line1}
        className="sm:col-span-2"
        maxLength={120}
      />
      <TextField
        label="Area, street, sector"
        autoComplete="address-line2"
        value={fields.line2}
        onChange={set("line2")}
        error={errors.line2}
        optional
        className="sm:col-span-2"
        maxLength={120}
      />
      <TextField label="Landmark" value={fields.landmark} onChange={set("landmark")} error={errors.landmark} optional maxLength={80} />
      <TextField label="City" autoComplete="address-level2" value={fields.city} onChange={set("city")} error={errors.city} maxLength={60} />
      <SelectField label="State" autoComplete="address-level1" value={fields.state} onChange={set("state")} error={errors.state}>
        <option value="" disabled>
          Choose a state
        </option>
        {INDIAN_STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Pincode"
        inputMode="numeric"
        autoComplete="postal-code"
        value={fields.pincode}
        onChange={set("pincode")}
        error={errors.pincode}
        maxLength={6}
      />

      <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-forest sm:col-span-2">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          disabled={address?.isDefault}
          className="size-5 rounded-md accent-forest"
        />
        {address?.isDefault ? "This is your default address" : "Make this my default address"}
      </label>

      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <Button type="submit" size="lg" disabled={save.isPending} aria-busy={save.isPending || undefined}>
          {save.isPending && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
