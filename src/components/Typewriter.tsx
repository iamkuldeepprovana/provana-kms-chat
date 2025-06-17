import React, { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import styles from "./Typewriter.module.css";

// Configure marked options for proper markdown rendering
marked.setOptions({
  breaks: true,  // Add line breaks
  gfm: true      // Use GitHub Flavored Markdown
});

// Add a custom renderer to handle lists properly
const renderer = new marked.Renderer();
marked.use({ renderer });

interface TypewriterProps {
  text: string;
  speed?: number; // ms per character
  onDone?: () => void;
}

const Typewriter: React.FC<TypewriterProps> = ({ text, speed = 8, onDone }) => {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);  useEffect(() => {
    // If new text is shorter, reset
    if (text.length < displayed.length) {
      setDisplayed("");
      indexRef.current = 0;
    }
    // If new text is longer, animate the new part
    if (text.length > displayed.length && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setDisplayed((prev) => {
          const next = text.slice(0, prev.length + 1);
          if (next.length === text.length) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            if (onDone) onDone();
          }
          return next;
        });
      }, speed);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  // Process the markdown to ensure bullet points are rendered properly
  const processedHtml = marked.parse(displayed) as string;

  return (
    <div 
      className={`typewriter-content ${styles.markdownContent}`} 
      dangerouslySetInnerHTML={{ __html: processedHtml }} 
    />
  );
};

export default Typewriter;
