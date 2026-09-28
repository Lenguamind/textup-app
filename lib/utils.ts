/**
 * Robustly parses a string that might contain a JSON block.
 * Handles cases where the LLM might wrap the JSON in markdown code blocks.
 */
export const parseRobustJson = (text: string) => {
  if (!text) {
    throw new Error("No text provided to parseRobustJson");
  }

  // Remove trailing commas to handle strict JSON.parse issues
  const sanitizeJson = (str: string) => str.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(sanitizeJson(text));
  } catch (e) {
    let cleaned = text.replace(/^```json/gmi, '').replace(/^```/gmi, '').replace(/```$/gmi, '').trim();
    try {
      return JSON.parse(sanitizeJson(cleaned));
    } catch (e2) {
      const objStart = text.indexOf("{");
      const objEnd = text.lastIndexOf("}");
      const arrStart = text.indexOf("[");
      const arrEnd = text.lastIndexOf("]");
      
      let extractStart = -1;
      let extractEnd = -1;
      
      const objLen = (objStart !== -1 && objEnd !== -1 && objEnd > objStart) ? objEnd - objStart : -1;
      const arrLen = (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) ? arrEnd - arrStart : -1;
      
      if (objLen > -1 && objLen >= arrLen) {
        extractStart = objStart;
        extractEnd = objEnd;
      } else if (arrLen > -1) {
        extractStart = arrStart;
        extractEnd = arrEnd;
      }
      
      if (extractStart !== -1 && extractEnd !== -1) {
        cleaned = text.substring(extractStart, extractEnd + 1);
        try {
          return JSON.parse(sanitizeJson(cleaned));
        } catch (e3) {
          console.error("Parsed subset failed:", cleaned.substring(0, 100));
          throw new Error("Invalid JSON structure detected in response: " + e3.message);
        }
      }
      console.error("JSON parsing completely failed. Raw text slice:", text.substring(0, 200));
      throw new Error("No valid JSON object found in response");
    }
  }
};

/**
 * Resizes a base64 image to a maximum dimension while maintaining aspect ratio.
 */
export const resizeImage = (base64Str: string, maxSize = 1000): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = (err) => reject(err);
  });
};

/**
 * Gets a value from an object by a dot-notated path string.
 */
export const getByPath = (obj: any, path: string, fallback?: any) => {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value && value[key] !== undefined) {
      value = value[key];
    } else {
      return fallback;
    }
  }
  return value !== undefined ? value : fallback;
};
