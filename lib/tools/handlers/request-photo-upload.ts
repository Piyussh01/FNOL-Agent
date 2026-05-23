import { z } from "zod";
import { stub } from "./_stub";

const Input = z.object({
  claim_id: z.string().uuid(),
  photo_kinds: z.array(z.string()).min(1),
  send_via: z.enum(["sms", "email", "both"]),
});

export default stub<z.infer<typeof Input>, { upload_urls: unknown[]; link_sent: boolean }>(
  "request_photo_upload",
  "Generate signed upload URLs and notify the caller.",
  Input,
);
