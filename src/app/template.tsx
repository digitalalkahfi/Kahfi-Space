import { TransisiHalaman } from "@/components/motion/transisi-halaman";

export default function Template({ children }: LayoutProps<"/">) {
  return <TransisiHalaman>{children}</TransisiHalaman>;
}
