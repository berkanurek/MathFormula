"use client";

import { MathfieldElement } from "mathlive";
import "mathlive/static.css";
import "mathlive";

if (typeof window !== "undefined") {
  MathfieldElement.fontsDirectory = "/fonts/mathlive";
}
