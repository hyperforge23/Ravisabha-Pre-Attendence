import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAttendance extends Document {
    smkDetailId?: mongoose.Types.ObjectId;
    ravisabhaId: mongoose.Types.ObjectId;
    SmkId?: string;
    familyCount?: number;
    mehmanCount?: number;
    status: "Present" | "Absent";
}

const PreAttendanceSchema: Schema<IAttendance> = new Schema(
    {
        smkDetailId: {
            type: Schema.Types.ObjectId,
            ref: "smkdetails",
        },
        ravisabhaId: {
            type: Schema.Types.ObjectId,
            ref: "ravisabha_details",
            required: true,
        },
        SmkId: { type: String },
        mehmanCount: {
            type: Number,
            default: 0,
        },
        familyCount: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ["Present", "Absent"],
            required: true,
            default: "Present",
        },
    },
    {
        timestamps: true,
        collection: "ravisabha_pre_attendances",
    }
);

const PreAttendance: Model<IAttendance> =
    (mongoose.models.ravisabha_pre_attendance as Model<IAttendance>) ??
    mongoose.model<IAttendance>("ravisabha_pre_attendance", PreAttendanceSchema);

export default PreAttendance;