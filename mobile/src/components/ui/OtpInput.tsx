import React, { useMemo, useRef, useState } from "react";
import { TextInput, View, type TextInput as TextInputType } from "react-native";
import { useTheme } from "@/theme/ThemeContext";

type OtpInputProps = {
  length?: number;
  value?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
};

export function OtpInput({ length = 4, value, onChange, onComplete }: OtpInputProps) {
  const theme = useTheme();
  const [internalValue, setInternalValue] = useState("");
  const refs = useRef<(TextInputType | null)[]>([]);
  const otp = value ?? internalValue;
  const digits = useMemo(() => Array.from({ length }, (_, index) => otp[index] ?? ""), [length, otp]);

  function update(nextValue: string) {
    const cleanValue = nextValue.replace(/\D/g, "").slice(0, length);
    if (value === undefined) {
      setInternalValue(cleanValue);
    }
    onChange?.(cleanValue);
    if (cleanValue.length === length) {
      onComplete?.(cleanValue);
    }
  }

  return (
    <View style={{ flexDirection: "row", gap: theme.spacing[3] }}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(input) => {
            refs.current[index] = input;
          }}
          accessibilityLabel={`OTP digit ${index + 1} of ${length}`}
          inputMode="numeric"
          keyboardType="number-pad"
          maxLength={1}
          onChangeText={(nextDigit) => {
            const nextDigits = [...digits];
            nextDigits[index] = nextDigit.replace(/\D/g, "").slice(-1);
            const nextValue = nextDigits.join("");
            update(nextValue);
            if (nextDigits[index] && index < length - 1) {
              refs.current[index + 1]?.focus();
            }
          }}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
          selectTextOnFocus
          style={[
            theme.typography.heading,
            {
              backgroundColor: theme.surface,
              borderColor: digit ? theme.primary : theme.border,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              color: theme.text,
              height: 54,
              textAlign: "center",
              width: 48,
            },
          ]}
          value={digit}
        />
      ))}
    </View>
  );
}
