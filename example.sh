# This is an example script to run when a file is scanned. 
# - ${1} will be the path to the file to scan.
# - The exit code should be 0 for files that are deemed safe/clean.
# - Anything sent to stdout will be included in the `info` section of the response.

echo "First line of file '${1}': $(head -z -n1 ${1})"

exit 1
