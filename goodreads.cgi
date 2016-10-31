#!/bin/sh
goodreadsAPIkey='JnUNQkset5HGYcWq8bVKXQ'

echo "Content-type: application/xml"
echo ""
WWW_isbn=`echo $QUERY_STRING | sed 's/^.*isbn=//' | sed -e 's/[^0-9X]//g'`

curl -s "http://www.goodreads.com/book/show?format=xml&key=$goodreadsAPIkey&isbn=$WWW_isbn"
