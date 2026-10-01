import { NextRequest, NextResponse } from "next/server";
import { PipelineStage } from "mongoose";
import { connectDb } from "@/lib/mongodb";
import SmkDetail from "@/models/SmkDetail";

export const dynamic = "force-dynamic";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface SmkDoc {
  _id?: { toString(): string } | string;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
  MobileNo?: number;
  SmkId?: string;
  FirstNameGuj?: string;
  MiddleNameGuj?: string;
  LastNameGuj?: string;
  Gender?: number;
}

function formatUser(doc: SmkDoc) {
  const firstName = doc.FirstName || "";
  const middleName = doc.MiddleName || "";
  const lastName = doc.LastName || "";
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const mobileStr =
    doc.MobileNo !== undefined && doc.MobileNo !== null
      ? String(doc.MobileNo)
      : "";

  return {
    id: doc._id ? doc._id.toString() : "",
    name: fullName,
    mobileNumber: mobileStr,
    mobileNo: mobileStr,
    smkNo: doc.SmkId || "",
    firstName: firstName,
    middleName: middleName,
    lastName: lastName,
    firstNameGuj: doc.FirstNameGuj || "",
    middleNameGuj: doc.MiddleNameGuj || "",
    lastNameGuj: doc.LastNameGuj || "",
    gender: doc.Gender !== undefined && doc.Gender !== null ? String(doc.Gender) : "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const mobileParam = searchParams.get("mobile");
    const queryParam = searchParams.get("query");

    // Mode 2: Search by mobile number (exact 10 digits match)
    if (mobileParam !== null) {
      const trimmedMobile = mobileParam.trim();
      if (!/^\d{10}$/.test(trimmedMobile)) {
        return NextResponse.json({ users: [] });
      }

      await connectDb();
      const users = await SmkDetail.find({ MobileNo: Number(trimmedMobile) }).lean();
      const formattedUsers = users.map(formatUser);
      return NextResponse.json({ users: formattedUsers });
    }

    // Mode 1: Search by text query
    if (!queryParam || !queryParam.trim()) {
      return NextResponse.json({ users: [] });
    }

    const words = queryParam.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return NextResponse.json({ users: [] });
    }

    await connectDb();

    const wordConditions = words.map((word) => {
      const safeWord = escapeRegex(word);
      return {
        $or: [
          { FirstName: { $regex: safeWord, $options: "i" } },
          { MiddleName: { $regex: safeWord, $options: "i" } },
          { LastName: { $regex: safeWord, $options: "i" } },
          { SmkId: { $regex: safeWord, $options: "i" } },
          { mobileStr: { $regex: safeWord, $options: "i" } },
          { FirstNameGuj: { $regex: safeWord, $options: "i" } },
          { MiddleNameGuj: { $regex: safeWord, $options: "i" } },
          { LastNameGuj: { $regex: safeWord, $options: "i" } },
        ],
      };
    });

    const pipeline: PipelineStage[] = [
      {
        $addFields: {
          mobileStr: { $toString: "$MobileNo" },
        },
      },
      {
        $match: {
          $and: wordConditions,
        },
      },
      {
        $sort: { FirstName: 1, LastName: 1 },
      },
      {
        $limit: 10,
      },
    ];

    const users = await SmkDetail.aggregate(pipeline);
    const formattedUsers = users.map(formatUser);

    return NextResponse.json({ users: formattedUsers });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
