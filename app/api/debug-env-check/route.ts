import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  let canQuery = false;
  if (hasKey) {
    const supabase = createServiceClient();
    if (supabase) {
      const { error } = await supabase.from("partners").select("id", { count: "exact", head: true });
      canQuery = !error;
    }
  }
  return NextResponse.json({ hasKey, canQuery });
}
