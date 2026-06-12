export async function GET() {
  return Response.json({
    enableOtpVerification: process.env.ENABLE_OTP_VERIFICATION === "true",
  });
}
