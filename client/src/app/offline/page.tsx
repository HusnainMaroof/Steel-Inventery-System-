import { Suspense } from "react";
import { OfflineClient } from "./OfflineClient";

export default function OfflinePage() {
  return (
    <Suspense>
      <OfflineClient />
    </Suspense>
  );
}
