#!/bin/bash

# Define an associative array to map pod numbers to colors
declare -A colors=(
    [0]="\033[38;5;117m" # pastel blue
    [1]="\033[38;5;204m" # pastel orange
    [2]="\033[38;5;156m" # pastel green
    [3]="\033[38;5;227m" # pastel yellow
)

horizontal_line() {
    output+=$(echo -ne "\033[38;5;242m") # Set background color to dark gray
    output+=$(printf "%*s" $(tput cols) | tr ' ' '-')
    output+=$(echo -ne "\033[0m\n") # Reset to default color
}

show_cache() {
    local cache_path="/home/node/cache"
    local files=$(kubectl -n ixy exec $pod -- find $cache_path -type f)
    local message="No files found."
    local terminal_width=$(tput cols)

    # Adjust the column widths as needed
    local file_width=$((terminal_width * 3 / 5))                    # Adjusted to 60% of terminal width for FILE
    local size_width=$((terminal_width / 10))                       # Adjusted to 10% of terminal width for SIZE
    local mtime_width=$((terminal_width - file_width - size_width)) # Remaining for MODIFIED TIME

    # Ensure the MODIFIED TIME header doesn't wrap by adjusting the column if necessary
    mtime_width=$((mtime_width - 2)) # Subtract a few characters to prevent wrapping

    # Append table header with right-aligned SIZE and MODIFIED TIME to the output variable
    output+=$(printf "\033[1m%-*s %*s %*s\033[0m\n" $file_width "FILE" $size_width "SIZE" $mtime_width "MOD. TIME\n")

    if [ -z "$files" ]; then
        local message_length=${#message}
        local padding=$(((terminal_width / 2) - (message_length / 2)))

        # Append empty message in bold, red, and centered to the output variable
        output+=$(printf "\033[1;31m%${padding}s${message}\033[0m\n")
        output+="\n" # Add an explicit newline character
    else
        for file in $files; do
            local file_path="$file"
            local size=$(kubectl -n ixy exec $pod -- du -sh $file_path | awk '{print $1}')
            local mtime=$(kubectl -n ixy exec $pod -- stat -c "%y" $file_path | awk -F"." '{print $1}')

            # Append each row with right-aligned SIZE and MODIFIED TIME to the output variable
            output+=$(printf "%-*s %*s %*s\n" $file_width "${file#$cache_path/}" $size_width "$size" $mtime_width "$mtime\n")
        done
    fi
}

while true; do
    output=""

    for pod in $(kubectl -n ixy get po -oname | cut -d'/' -f2); do
        horizontal_line

        # Extract the pod number from the pod name
        pod_number="${pod##*-}"

        # Get the color corresponding to the pod number
        color="${colors[$pod_number]}"

        # Calculate padding for centering the pod name
        padding=$(($(tput cols) / 2 - ${#pod} / 2))

        # Build the output string
        output+="\n%${padding}s"            # Add padding before the pod name
        output+="${color}${pod^^}\033[0m\n" # Print the pod name with color

        horizontal_line

        show_cache

        horizontal_line
    done

    # Clear the screen
    clear

    # Print the output string
    printf "$output"
done
