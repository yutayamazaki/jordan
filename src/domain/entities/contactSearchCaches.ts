import { z } from "zod";
import { ContactResponseSchema } from "./contact";

export const ContactSearchCachesRecordSchema = z.object({
  id: z.string().uuid(),
  domain: z.string(),
  department: z.string(),
  companyName: z.string().optional(),
  contacts: z.array(ContactResponseSchema),
  searchedAt: z.string().datetime(),
});

export type ContactSearchCachesRecord = z.infer<typeof ContactSearchCachesRecordSchema>;

