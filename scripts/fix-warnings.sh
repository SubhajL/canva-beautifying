#!/bin/bash

# Extract warnings from build output and organize by file
echo "Extracting warnings from build output..."

# Create a temporary directory for our work
mkdir -p .tmp-warnings

# Parse the build output and create individual files for each source file with warnings
grep -E "^\./" build-output.log | while read -r line; do
  if [[ $line =~ ^(\./[^:]+):([0-9]+):([0-9]+)[[:space:]]+Warning:[[:space:]]+(.+) ]]; then
    file="${BASH_REMATCH[1]}"
    line_num="${BASH_REMATCH[2]}"
    col_num="${BASH_REMATCH[3]}"
    warning="${BASH_REMATCH[4]}"
    
    # Create a safe filename for the warnings file
    safe_filename=$(echo "$file" | sed 's/[^a-zA-Z0-9._-]/_/g')
    
    # Append warning to file-specific warnings file
    echo "${line_num}:${col_num}:${warning}" >> ".tmp-warnings/${safe_filename}.warnings"
  fi
done

# Count warnings by type
echo -e "\n=== Warning Summary ==="
grep -E "Warning:" build-output.log | sed 's/.*Warning: //' | sort | uniq -c | sort -nr

# List files with most warnings
echo -e "\n=== Files with Most Warnings ==="
for f in .tmp-warnings/*.warnings; do
  if [ -f "$f" ]; then
    count=$(wc -l < "$f")
    filename=$(basename "$f" .warnings | sed 's/_/\//g')
    echo "$count warnings in $filename"
  fi
done | sort -nr | head -20

echo -e "\nWarning analysis complete. Check .tmp-warnings/ for detailed file-by-file warnings."