# Run the c-icap-client, sending file at $1
#
# This sends file at $1 over ICAP, with -v enabled so that we print
# response headers to stderr, which we divert to stdout and into grep.
#
# -no204 prevents 204 Unmodified from being given; matrix-content-scanner
# doesn't handle the case where the file's status hasn't changed.
#
c-icap-client -i 10.25.0.21 -p 1344 -f $1 -s srv_clamav -no204 -v 2>&1 \
    | grep --quiet '403 Forbidden'

# Negate the grep; if we find 403 Forbidden in the response headers,
# the grep will exit 0, so negate that to 1. 
test $? -eq 1
