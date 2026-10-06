import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAttendance extends Document {
    smkDetailId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    ravisabhaId?: mongoose.Types.ObjectId;
    status: "present" | "absent";
    date: Date;
    SmkId: string;
    name: string;
}

const PreAttendanceSchema: Schema<IAttendance> = new Schema(
    {
        smkDetailId: {
            type: Schema.Types.ObjectId,
            ref: "smkdetails",
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true,
        },
        ravisabhaId: {
            type: Schema.Types.ObjectId,
            ref: "ravisabha_details",
        },
        name: {
            type: String,
        },
        status: {
            type: String,
            enum: ["present", "absent"],
            default: "absent",
        },
        SmkId: { type: String, required: true },
        date: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

const PreAttendance: Model<IAttendance> =
    mongoose.models.ravisabha_pre_attendance ||
    mongoose.model<IAttendance>("ravisabha_pre_attendance", PreAttendanceSchema);

export default PreAttendance;