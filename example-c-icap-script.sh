# Run the c-icap-client, sending file at $1
#
# This sends file at $1 over ICAP, with -v enabled so that we print
# response headers to stderr, which we divert to stdout and into grep.
#
# -no204 prevents 204 Unmodified from being given; matrix-content-scanner
# doesn't handle the case where the file's status hasn't changed.
#
c-icap-client -i ICAP_SERVER_ADDRESS -p ICAP_SERVER_PORT -f $1 -s ICAP_SERVICE -no204 -v 2>&1 \
    | grep --quiet '403 Forbidden'

# Negate the grep; if we find 403 Forbidden in the response headers,
# the grep will exit 0, so negate that to 1. 
test $? -eq 1
