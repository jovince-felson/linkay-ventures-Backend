import { z } from "zod";

const strongPassword = z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const sixDigitPasscode = z.string()
    .regex(/^[0-9]{6}$/, "Passcode must be exactly 6 digits");

export const RegisterViaEmail = z.object({
    body: z.object({
        email: z.email("Please Provide A Valid Email"),

        password: strongPassword,

        confirm_password: strongPassword,

        device_id: z.string().min(1, "Device ID is required"),

        device_name: z.string().min(1, "Device name is required"),

        fcm_token: z.string().min(1, "Fcm Token is Required"),

        phone_number: z
            .string()
            .regex(/^\+?[0-9]+$/, "Phone Number Should Only Contain Numbers and an optional leading +")
            .min(7, "Phone Number Cannot Be Below 7 digits")
            .max(15, "Phone Number Cannot Exceed 15 digits"),

        country_id: z.string().min(1, "Please Select A Country"),
    })
})
    .refine((data) => data.body.password === data.body.confirm_password, {
        message: "Passwords do not match",
        path: ["body", "confirm_password"],
    });

export const RegisterViaPhone = z.object({
    body: z.object({
        phone_number: z
            .string()
            .regex(/^\+?[0-9]+$/, "Phone Number Should Only Contain Numbers and an optional leading +")
            .min(7, "Phone Number Cannot Be Below 7 digits")
            .max(15, "Phone Number Cannot Exceed 15 digits"),

        country_id: z.string().min(1, "Please Select A Country"),

        password: strongPassword,

        confirm_password: strongPassword,

        device_id: z.string().min(1, "Device ID is required"),

        device_name: z.string().min(1, "Device name is required"),

        fcm_token: z.string().min(1, "Fcm Token is Required"),
    }),
})
    .refine(
        (data) => data.body.password === data.body.confirm_password,
        {
            message: "Passwords do not match",
            path: ["body", "confirm_password"],
        }
    );

export const RegisterViaGoogle = z.object({
    body: z.object({
        id_token: z.string().min(1, "Please Provide The Token"),
        device_id: z.string().min(1, "Device ID is required"),
        device_name: z.string().min(1, "Device name is required"),
        fcm_token: z.string().min(1, "Fcm Token is Required"),
    }),
});

export const RegisterViaApple = z.object({
    body: z.object({
        id_token: z.string().min(1, "Please Provide The Token"),
        device_id: z.string().min(1, "Device ID is required"),
        device_name: z.string().min(1, "Device name is required"),
        fcm_token: z.string().min(1, "Fcm Token is Required"),
    }),
});

export const EmailOTPValidator = z.object({
    body: z.object({
        session_id: z.string().min(1, "Please Provide The Session ID"),
        user_id: z.string().min(1, "Please Provide The User ID"),
        device_id: z.string().min(1, "Device ID is required"),
        device_name: z.string().min(1, "Device name is required"),
    }),
});

export const MobileOTPValidator = z.object({
    body: z.object({
        session_id: z.string().min(1, "Please Provide The Session ID"),
        user_id: z.string().min(1, "Please Provide The User ID"),
        device_id: z.string().min(1, "Device ID is required"),
        device_name: z.string().min(1, "Device name is required"),
    }),
});

export const OTPVerifyValidator = z.object({
    body: z.object({
        session_id: z.string().min(1, "Please Provide The Session ID"),
        user_id: z.string().min(1, "Please Provide The User ID"),
        device_id: z.string().min(1, "Device ID is required"),
        device_name: z.string().min(1, "Device name is required"),
        otp: z.string().regex(/^[0-9]{6}$/, "Please Provide A Valid 6-digit OTP"),
    }),
});

export const LoginViaEmail = z.object({
    body: z.object({
        email: z.email("Please Provide A Valid Email"),
        password: z.string().min(8, "Password must be at least 8 characters long"),
        fcm_token: z.string().min(1, "Fcm Token is Required"),
        device_id: z.string().min(1, "Device ID is required"),
        device_name: z.string().min(1, "Device name is required"),
    }),
});

export const LoginViaMobile = z.object({
    body: z.object({
        phone_number: z.string(),
        country_id: z.string().min(1, "Please Select A Country"),
        fcm_token: z.string().min(1, "Fcm Token is Required"),
        password: z.string().min(8, "Password must be at least 8 characters long"),
        device_id: z.string().min(1, "Device ID is required"),
        device_name: z.string().min(1, "Device name is required"),
    })
});

export const ForgotPasswordValidator = z.object({
    body: z.object({
        email: z.string().optional(),
        phone_number: z.string().optional(),
        device_id: z.string().min(1, "Device ID is required"),
    }).refine(
        (data) => !!data.email || !!data.phone_number,
        {
            message: "Email or Phone Number is required",
            path: ["body"],
        }
    ),
});

export const ChangePasswordValidator = z.object({
    body: z.object({
        password: strongPassword,
        confirm_password: strongPassword,
        user_id: z.string().min(1, "User ID is required"),
        reset_session_id: z.string().min(1, "Reset session ID is required"),
        device_id: z.string().min(1, "Device ID is required"),
    }).refine(
        (data) => data.password === data.confirm_password,
        {
            message: "Passwords do not match",
            path: ["body", "confirm_password"],
        }
    ),
});

export const VerifyPasswordResetTokenValidator = z.object({
    body: z.object({
        otp: z.string().min(4, "Please Provide A Valid OTP"),
        user_id: z.string().min(1, "Please Provide The User ID"),
        reset_session_id: z.string().min(1, "Please Provide The Reset Session ID"),
        device_id: z.string().min(1, "Device ID is required"),
    }),
});

export const AddPasskeyValidator = z.object({
    body: z.object({
        session_id: z.string().min(1, "Please Provide The Session ID"),
        user_id: z.string().min(1, "Please Provide The User ID"),
        device_id: z.string().min(1, "Device ID is required"),
        device_name: z.string().min(1, "Device name is required"),
        passcode: sixDigitPasscode,
        confirm_passcode: sixDigitPasscode,
    }),
}).refine(
    (data) => data.body.passcode === data.body.confirm_passcode,
    {
        message: "Passkeys do not match",
        path: ["body", "confirm_passcode"],
    }
);

export const PasskeyAuthValidator = z.object({
    body: z.object({
        session_id: z.string().min(1, "Please Provide The Session ID"),
        user_id: z.string().min(1, "Please Provide The User ID"),
        device_id: z.string().min(1, "Device ID is required"),
        passcode: sixDigitPasscode,
    }),
});

export const ForgotPasskeyValidator = z.object({
    body: z.object({
        user_id: z.string().min(1, "Please Provide The User ID"),
    }),
});

export const GeneralOTPValidator = z.object({
    body: z.object({
        otp: z.string().regex(/^[0-9]{6}$/, "Please Provide A Valid 6-digit OTP"),
    }),
});

export const BioMetricValidator = z.object({
    body: z.object({
        session_id: z.string().min(1, "Please Provide The Session ID"),
        user_id: z.string().min(1, "Please Provide The User ID"),
        device_id: z.string().min(1, "Device ID is required"),
        device_name: z.string().min(1, "Please provide the device name"),
        status: z.enum(["1", "0"]),
    }),
});

export const DeviceListValidator = z.object({
    body: z.object({
        session_id: z.string().min(1, "Please Provide The Session ID"),
        user_id: z.string().min(1, "Please Provide The User ID"),
        device_id: z.string().min(1, "Device ID is required"),
    }),
});

export const SignOutValidator = z.object({
    body: z.object({
        session_id: z.string().min(1, "Please Provide The Session ID"),
        session_revoke_id: z.string().min(1, "Please Provide The Session ID"),
        user_id: z.string().min(1, "Please Provide The User ID"),
        device_id: z.string().min(1, "Device ID is required"),
    }),
});

export const ResetPasskeyValidator = z.object({
    body: z.object({
        session_id: z.string().min(1, "Please Provide The Session ID"),
        user_id: z.string().min(1, "Please Provide The User ID"),
        device_id: z.string().min(1, "Device ID is required"),
        device_name: z.string().min(1, "Device name is required"),
        new_passkey: sixDigitPasscode,
        old_passkey: sixDigitPasscode,
        new_confirm_passkey: sixDigitPasscode,
    }),
}).refine(
    (data) => data.body.new_passkey === data.body.new_confirm_passkey,
    {
        message: "Passkeys do not match",
        path: ["body", "new_confirm_passkey"],
    }
);

