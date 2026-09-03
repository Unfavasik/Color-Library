"use client";

import { CopyCode } from "@/components/ui/copy-code-button";
import SmokyButton from "@/components/ui/smoky-button";

const smokeColors = {
  primary: "#002FA7",
  secondary: "#5C331F",
  shadow: "#050506",
};

export function SmokyButtonDemo() {
  return (
    <main className="smoky-demo">
      <div className="smoky-demo__content">
        <SmokyButton colors={smokeColors}>Smoky Button</SmokyButton>
      </div>
    </main>
  );
}

export default function DemoOne() {
  return (
    <div className="w-full">
      <CopyCode />
    </div>
  );
}

