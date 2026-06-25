// Libra-Local — desktop/iOS (Tauri) entry point.

import { startApp } from "@/core/app";
import { createLibraryView } from "@/components/Library/LibraryView";

startApp(createLibraryView);
