"use client";

import { useParams } from "next/navigation";
import { RoomFormPage } from "@/components/settings/rooms/RoomFormPage";

export default function EditRoomRoute() {
    const params = useParams();
    const id = String(params.id);
    return <RoomFormPage mode="edit" roomId={id} />;
}
