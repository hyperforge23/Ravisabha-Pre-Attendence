import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/mongodb";
import PreAttendance from "@/models/PreAttendence";
import RavisabhaDetails from "@/models/RavisabhaDetails";
import SmkDetail from "@/models/SmkDetail";

export const dynamic = "force-dynamic";

/**
 * POST /api/pre-attendance
 *
 * Bulk-inserts pre-attendance records for a list of members.
 *
 * Body:
 * {
 *   members: [
 *     { smkDetailId: string, userId: string, SmkId: string, name: string }
 *   ]
 * }
 *
 * ravisabhaId is auto-resolved from the RavisabhaDetails record where
 * pre_attendance === true. Request is rejected if no such record exists.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const { members } = body as {
      members?: Array<{
        smkDetailId: string;
        userId: string;
        SmkId: string;
        name: string;
      }>;
    };

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { success: false, error: "Request body must include a non-empty `members` array." },
        { status: 400 }
      );
    }

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m.smkDetailId || !m.userId || !m.SmkId || !m.name) {
        return NextResponse.json(
          {
            success: false,
            error: `Member at index ${i} is missing one or more required fields: smkDetailId, userId, SmkId, name.`,
          },
          { status: 400 }
        );
      }
    }

    await connectDb();

    // Resolve the active Ravisabha where pre_attendance === true
    const activeRavisabha = await RavisabhaDetails.findOne({ pre_attendance: true })
      .select("_id date")
      .lean<{ _id: unknown; date: Date }>();

    if (!activeRavisabha) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No active Ravisabha found.",
        },
        { status: 404 }
      );
    }

    const ravisabhaId = (activeRavisabha._id as { toString(): string }).toString();
    const now = new Date();

    const docs = members.map((m) => ({
      smkDetailId: m.smkDetailId,
      userId: m.userId,
      ravisabhaId,
      SmkId: m.SmkId,
      name: m.name,
      status: "present" as const,
      date: now,
    }));

    // ordered:false — skip duplicates and continue inserting the rest
    let insertedCount = 0;
    let skippedCount = 0;

    try {
      const result = await PreAttendance.insertMany(docs, { ordered: false });
      insertedCount = result.length;
    } catch (bulkErr: unknown) {
      if (
        bulkErr instanceof Error &&
        "writeErrors" in bulkErr &&
        "insertedDocs" in bulkErr
      ) {
        const bwErr = bulkErr as {
          writeErrors: unknown[];
          insertedDocs: unknown[];
        };
        insertedCount = bwErr.insertedDocs?.length ?? 0;
        skippedCount = bwErr.writeErrors?.length ?? 0;
        if (insertedCount === 0) throw bulkErr;
      } else {
        throw bulkErr;
      }
    }

    skippedCount = skippedCount || docs.length - insertedCount;

    return NextResponse.json(
      {
        success: true,
        message: "Pre-attendance recorded successfully.",
        ravisabhaId,
        ravisabhaDate: activeRavisabha.date,
        totalSubmitted: docs.length,
        inserted: insertedCount,
        skipped: skippedCount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[/api/pre-attendance] POST Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pre-attendance
 *
 * Returns all pre-attendance entries for the currently active Ravisabha.
 *
 * Optional query param:
 *   ?mobile=9876543210  -> filter records by the member mobile number
 */
export async function GET(request: NextRequest) {
  try {
    await connectDb();

    const activeRavisabha = await RavisabhaDetails.findOne({ pre_attendance: true })
      .select("ravisabhaId date")
      .lean<{ ravisabhaId: string; date: Date }>();

    if (!activeRavisabha) {
      return NextResponse.json(
        { success: false, error: "No active Ravisabha found." },
        { status: 404 }
      );
    }

    const ravisabhaObjectId = activeRavisabha.ravisabhaId;
    const { searchParams } = request.nextUrl;
    const mobileParam = searchParams.get("mobile");

    if (mobileParam) {
      const trimmed = mobileParam.trim();
      if (!/^\d{10}$/.test(trimmed)) {
        return NextResponse.json(
          { success: false, error: "Invalid mobile number. Must be exactly 10 digits." },
          { status: 400 }
        );
      }

      const smkDocs = await SmkDetail.find(
        { MobileNo: Number(trimmed) },
        { _id: 1 }
      ).lean<{ _id: unknown }[]>();

      const smkIds = smkDocs.map((d) => d._id);

      const records = await PreAttendance.find({
        ravisabhaId: ravisabhaObjectId,
        smkDetailId: { $in: smkIds },
      }).lean();

      return NextResponse.json({
        success: true,
        ravisabhaId: ravisabhaObjectId,
        ravisabhaDate: activeRavisabha.date,
        total: records.length,
        records,
      });
    }

    const records = await PreAttendance.find({
      ravisabhaId: ravisabhaObjectId,
    }).lean();

    return NextResponse.json({
      success: true,
      ravisabhaId: ravisabhaObjectId,
      ravisabhaDate: activeRavisabha.date,
      total: records.length,
      records,
    });
  } catch (error) {
    console.error("[/api/pre-attendance] GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}
