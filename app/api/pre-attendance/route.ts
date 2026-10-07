import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/mongodb";
import PreAttendance from "@/models/PreAttendence";
import RavisabhaDetails from "@/models/RavisabhaDetails";
import SmkDetail from "@/models/SmkDetail";
import mongoose from "mongoose";

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
        smkDetailId?: string;
        SmkId?: string;
        mehmanCount?: number;
        familyCount?: number;
      }>;
    };

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { success: false, error: "Request body must include a non-empty `members` array." },
        { status: 400 }
      );
    }

    await connectDb();

    // Resolve the active Ravisabha where pre_attendance === true
    const activeRavisabha = await RavisabhaDetails.findOne({ pre_attendance: true })
      .select("_id date")
      .lean<{ _id: mongoose.Types.ObjectId; date: Date }>();

    if (!activeRavisabha) {
      return NextResponse.json(
        { success: false, error: "No active Ravisabha found." },
        { status: 404 }
      );
    }

    const ravisabhaId = activeRavisabha._id.toString();

    const docs = members.map((m) => ({
      ...(m.smkDetailId ? { smkDetailId: m.smkDetailId } : {}),
      ...(m.SmkId ? { SmkId: m.SmkId } : {}),
      ravisabhaId,
      mehmanCount: m.mehmanCount ?? 0,
      familyCount: m.familyCount ?? 0,
    }));

    console.log("[pre-attendance] inserting docs:", JSON.stringify(docs.map(d => ({ SmkId: d.SmkId, mehmanCount: d.mehmanCount, familyCount: d.familyCount }))));

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
 *   ?mobile=9876543210  -> filter records by the member's mobile number
 *   ?smkDetailIds=id1,id2  -> filter records by specific smkDetailIds (comma-separated)
 */
export async function GET(request: NextRequest) {
  try {
    await connectDb();

    // Use _id (not a non-existent ravisabhaId field) when resolving the active ravisabha
    const activeRavisabha = await RavisabhaDetails.findOne({ pre_attendance: true })
      .select("_id date")
      .lean<{ _id: mongoose.Types.ObjectId; date: Date }>();

    if (!activeRavisabha) {
      return NextResponse.json(
        { success: false, error: "No active Ravisabha found." },
        { status: 404 }
      );
    }

    const ravisabhaId = activeRavisabha._id.toString();
    const { searchParams } = request.nextUrl;
    const mobileParam = searchParams.get("mobile");
    const smkDetailIdsParam = searchParams.get("smkDetailIds");

    // Filter by specific smkDetailIds (used by the toggle feature to check already-marked members)
    if (smkDetailIdsParam) {
      const ids = smkDetailIdsParam.split(",").map((id) => id.trim()).filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ success: true, ravisabhaId, ravisabhaDate: activeRavisabha.date, total: 0, records: [] });
      }

      const records = await PreAttendance.find({
        ravisabhaId,
        smkDetailId: { $in: ids },
      }).lean();

      return NextResponse.json({
        success: true,
        ravisabhaId,
        ravisabhaDate: activeRavisabha.date,
        total: records.length,
        records,
      });
    }

    // Filter by mobile number — look up matching SmkDetail docs first
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
      ).lean<{ _id: mongoose.Types.ObjectId }[]>();

      const smkIds = smkDocs.map((d) => d._id.toString());

      const records = await PreAttendance.find({
        ravisabhaId,
        smkDetailId: { $in: smkIds },
      }).lean();

      return NextResponse.json({
        success: true,
        ravisabhaId,
        ravisabhaDate: activeRavisabha.date,
        total: records.length,
        records,
      });
    }

    // No filter — return all records for the active Ravisabha
    const records = await PreAttendance.find({ ravisabhaId }).lean();

    return NextResponse.json({
      success: true,
      ravisabhaId,
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

/**
 * PATCH /api/pre-attendance
 *
 * Updates the mehmanCount and/or familyCount on an existing pre-attendance record.
 * Used when the first (searched) member is already marked present and the counters change.
 *
 * Body:
 * {
 *   smkDetailId: string,
 *   mehmanCount: number,
 *   familyCount: number
 * }
 */
export async function PATCH(request: NextRequest) {
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

    const { smkDetailId, mehmanCount, familyCount } = body as {
      smkDetailId?: string;
      mehmanCount?: number;
      familyCount?: number;
    };

    if (!smkDetailId) {
      return NextResponse.json(
        { success: false, error: "smkDetailId is required." },
        { status: 400 }
      );
    }

    if (typeof mehmanCount !== "number" || mehmanCount < 0) {
      return NextResponse.json(
        { success: false, error: "mehmanCount must be a non-negative number." },
        { status: 400 }
      );
    }

    if (typeof familyCount !== "number" || familyCount < 0) {
      return NextResponse.json(
        { success: false, error: "familyCount must be a non-negative number." },
        { status: 400 }
      );
    }

    await connectDb();

    const activeRavisabha = await RavisabhaDetails.findOne({ pre_attendance: true })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId }>();

    if (!activeRavisabha) {
      return NextResponse.json(
        { success: false, error: "No active Ravisabha found." },
        { status: 404 }
      );
    }

    const ravisabhaId = activeRavisabha._id.toString();

    const updated = await PreAttendance.findOneAndUpdate(
      { ravisabhaId, smkDetailId },
      { $set: { mehmanCount, familyCount } },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Attendance record not found for this member." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      smkDetailId,
      mehmanCount: updated.mehmanCount,
    });
  } catch (error) {
    console.error("[/api/pre-attendance] PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pre-attendance
 *
 * Removes pre-attendance records for the given smkDetailIds under the active Ravisabha.
 * Used when a user unchecks a member who was already marked present.
 *
 * Body:
 * {
 *   smkDetailIds: string[]
 * }
 */
export async function DELETE(request: NextRequest) {
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

    const { smkDetailIds } = body as { smkDetailIds?: string[] };

    if (!Array.isArray(smkDetailIds) || smkDetailIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Request body must include a non-empty `smkDetailIds` array." },
        { status: 400 }
      );
    }

    await connectDb();

    const activeRavisabha = await RavisabhaDetails.findOne({ pre_attendance: true })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId }>();

    if (!activeRavisabha) {
      return NextResponse.json(
        { success: false, error: "No active Ravisabha found." },
        { status: 404 }
      );
    }

    const ravisabhaId = activeRavisabha._id.toString();

    const result = await PreAttendance.deleteMany({
      ravisabhaId,
      smkDetailId: { $in: smkDetailIds },
    });

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
      ravisabhaId,
    });
  } catch (error) {
    console.error("[/api/pre-attendance] DELETE Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}
