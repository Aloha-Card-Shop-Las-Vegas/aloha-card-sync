import React, { useEffect, useRef, useState } from 'react';

interface FitTextProps {
  children: React.ReactNode;
  maxFontSize?: number;
  minFontSize?: number;
  className?: string;
}

export const FitText: React.FC<FitTextProps> = ({ 
  children, 
  maxFontSize = 16, 
  minFontSize = 8,
  className = ""
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useEffect(() => {
    const adjustFontSize = () => {
      if (!containerRef.current || !textRef.current) return;

      const container = containerRef.current;
      const text = textRef.current;
      
      let currentSize = maxFontSize;
      text.style.fontSize = `${currentSize}px`;
      
      // Reduce font size until text fits within container
      while (currentSize > minFontSize && 
             (text.scrollWidth > container.clientWidth || text.scrollHeight > container.clientHeight)) {
        currentSize--;
        text.style.fontSize = `${currentSize}px`;
      }
      
      setFontSize(currentSize);
    };

    // Use ResizeObserver to adjust when container size changes
    const resizeObserver = new ResizeObserver(adjustFontSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Initial adjustment
    adjustFontSize();

    return () => resizeObserver.disconnect();
  }, [children, maxFontSize, minFontSize]);

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`} style={{ width: '100%', height: '100%' }}>
      <div 
        ref={textRef}
        style={{ 
          fontSize: `${fontSize}px`,
          lineHeight: '1.1',
          whiteSpace: 'nowrap',
          overflow: 'hidden'
        }}
      >
        {children}
      </div>
    </div>
  );
};