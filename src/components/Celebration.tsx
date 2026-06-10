import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Check } from "lucide-react";

const PHRASES = ["Nice!", "Crushed it!", "Boom!", "Smooth.", "Legend.", "Done & dusted.", "+1 streak"];

export function Celebration({ open, onDone }: { open: boolean; onDone: () => void }) {
  useEffect(() => {
    if (!open) return;
    const colors = ["#ff3ea5", "#9b5cff", "#3ee0ff", "#caff3a"];
    confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 }, colors });
    confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [open, onDone]);

  const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-50 grid place-items-center"
        >
          <motion.div
            initial={{ scale: 0.4, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="grid h-28 w-28 place-items-center rounded-full bg-gradient-energy shadow-pop">
              <Check className="h-14 w-14 text-primary-foreground" strokeWidth={3} />
            </div>
            <div className="rounded-full bg-background/80 backdrop-blur px-5 py-2 text-2xl font-bold font-display tracking-tight text-gradient-primary">
              {phrase}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
