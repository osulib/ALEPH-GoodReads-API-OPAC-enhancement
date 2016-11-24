var goodReads=new Object();
// !!! set these variables first your access key to GoodReads API here ?
goodReads.ratingStarFull='/goodreads/rating_plus.gif' ;//url path to star (full star)
goodReads.ratingStarEmpty='/goodreads/rating_minus.gif' ;//url path to star (emptz star)
goodReads.logo='/goodreads/goodreads_logo.gif' ;//url path to logo . it is added to cover image
goodReads.cgiPath='/cgi-bin/goodreads.cgi'; //path to cgi script for generating API call and processing its response (API cannot be called directlz due to CORS policy)
//Method for getting ISBN(s). The ISBNs are searched in whole text of html page on base of syntax and check count (both 10-ISBN and 13-ISBN). 
//This is a universal solution regardeless page structure and objects. 
//Still, especially if more various data is loaded on the web page, some identifiters can be loaded that did not refer to the main displayed book.
//For exclusion on not valid ISBNs with valid check count, set their displaying with initial exclamation mark (!). 
// Namely set your 'edit_field.eng', 'edit.field.{lng}' for 020 Marc21 ISBN field subfield z as follows:
//
//1 # 020## D
//2                        a
//2                        c   ^
//2                        q A ^
//2                        z A ^*^!       ^(err.)
//
goodReads.getISBNs = function() { 
   var isbnRegex=new RegExp('(([^\\d](97[8|9][\\- ])?[\\dM][\\d\\- ]{10}[\\- ][\\dxX])|([^\\d](97[8|9])?[\\dM]\\d{8}[\\dXx]))|([^\\d]\\d{4}\\-[\\dxX]{4})[^\\d\'"]','g');
   var bodyText=(document.body.textContent || document.body.innerText);
   var isbnF=(bodyText.match(isbnRegex));
   if ( isbnF==null) {return [];}
   isbnF=identifiers.removeCancelledIds(isbnF,'!',9,17);
   //get unique values
   isbnF.sort();
   for ( var i=0; i<isbnF.length; i++ ) {
      if ( isbnF[i].match(/^[\d]{4}\-[\dxX]{4}.{1}/) ) { isbnF[i]=isbnF[i].slice(0,-1); } 
      if ( isbnF[i] === isbnF[i-1] ) isbnF.splice(i--, 1);
      }
   //isbn validity check
   for ( i=0; i<isbnF.length; i++ ) {
      var isbn2check = (isbnF[i].replace(/^\s?M\-?/,'979-0-')).replace(/[^\dxX]/g,'');
      var checkSum=0;
      if ( isbn2check.length == 10 ) { //ISBN-10
	 for ( var j=0; j<10; j++ ) checkSum += (10-j) * parseInt(isbn2check.charAt(j).replace(/[xX]/,10));
         if ( checkSum%11!=0 ) { isbnF.splice(i,1); i--; } }
      else if ( isbn2check.length == 13 ) { //ISBN-13, ISMN (10+13)
	 for ( j=0; j<13; j++ ) checkSum += ( ( j%2==0 ) ? 1 : 3 ) * parseInt(isbn2check.charAt(j));
         if ( checkSum%10!=0) { isbnF.splice(i,1); i--; } }
      else if (  isbn2check.length == 8 ) { //ISSN
	 for ( var j=0; j<8; j++ ) checkSum += (8-j) * parseInt(isbn2check.charAt(j).replace(/[xX]/,10)); 
         if ( checkSum%11!=0 ) { isbnF.splice(i,1); i--;  }
         }
      else { isbnF.splice(i,1); i--; }
      }
   return isbnF; //returns an array with isbns
   }
//define objects for storing values from API response
goodReads.cover=new Array();
goodReads.description=new Array();
goodReads.rating=false; goodReads.noOfRatings=0; 
goodReads.backLink=false;
goodReads.reviews=new Array();
//method for calling API 
goodReads.ask = function() {
   if (typeof XMLHttpRequest == "undefined") {console.warn('Your browser does not support object XMLHttpRequest, I cannot call GoodReads API!'); return; }
   isbns=goodReads.getISBNs();
   if ( isbns.length == 0 ) {return;}
   goodReads.request = new Array();
   goodReads.NoOfRequests=isbns.length;
   for ( var i=0; i<isbns.length; i++ ) {
      goodReads.request[i] = new XMLHttpRequest();
      goodReads.request[i].open('GET', goodReads.cgiPath+'?isbn='+isbns[i].replace(/[^\dxX]/g,''), true);
      goodReads.request[i].send(null);
      goodReads.request[i].onreadystatechange=function () {
	 if (this.readyState==4 && this.status >= 200 && this.status < 400 ) {
	    goodReads.NoOfRequests--;
	    if ( this.responseText.indexOf('<GoodreadsResponse>')==-1 ) { console.warn('Response from GoodReads API looks invalid: '+this.responseText); return; }
	    var response=this.responseXML;
	    if ( response.getElementsByTagName('book').length == 0 ) { return;} //the response does not look like expected xml response
	    //parse API response
	    //remove similar_books from further processing (not to read their covers, ratings etc.)
	    var similarBooks = response.getElementsByTagName('similar_books');
	    for (var j=0; j<similarBooks.length; j++) { similarBooks[j].parentNode.removeChild(similarBooks[j]);}
//RC1 - response can include xml elements (lenth is gt 0), but these el. are empty. They have been removed from processing. 20161124
		            if ( response.getElementsByTagName('image_url').length>0 ) {
               if (  getTextNode(response.getElementsByTagName('image_url')[0]) != '') {
                  goodReads.cover.push( getTextNode(response.getElementsByTagName('image_url')[0]) ); } }
            if ( response.getElementsByTagName('description').length>0 ) {
               if (  getNodeCdata(response.getElementsByTagName('description')[0]) != '') {
                  goodReads.description.push( getNodeCdata(response.getElementsByTagName('description')[0]) ); } }
            if ( response.getElementsByTagName('average_rating').length>0 ) {
               var ratingTmp=Number(getTextNode(response.getElementsByTagName('average_rating')[0]));
               if ( !goodReads.rating ) {
                        goodReads.rating=ratingTmp;
                        goodReads.noOfRatings=1;}
               else {
                     goodReads.rating = ( goodReads.rating * goodReads.noOfRatings + ratingTmp ) / ( goodReads.noOfRatings+1);
                     goodReads.noOfRatings++; }
               }
            if ( response.getElementsByTagName('url').length>0 && !goodReads.backLink ) {
               if ( getNodeCdata(response.getElementsByTagName('url')[0]) != '' ) {
                  goodReads.backLink = getNodeCdata(response.getElementsByTagName('url')[0]); } }
            if ( response.getElementsByTagName('reviews_widget').length>0  ) {
               if ( getNodeCdata( response.getElementsByTagName('reviews_widget')[0]) != '' ) {
                  goodReads.reviews.push(  getNodeCdata( response.getElementsByTagName('reviews_widget')[0]) ); } }
//RC1 end 
	    //check if all responses have come. If so, show results
	    if ( goodReads.NoOfRequests == 0 ) { goodReads.show(); }
	    }
	 } 
      }
   }
//main method to show results from API response
goodReads.show = function() {
   if (goodReads.cover.length>0) { goodReads.showCover(); }
   if (goodReads.description.length>0) { goodReads.showDescription(); }
   if (goodReads.rating) { goodReads.showRating(); }  --- not in use @ osu.cz
   if (goodReads.reviews.length>0) { goodReads.showReviews(); }

   }
   //methods to display individual data from API response
goodReads.showCover = function() {
   var targetEl= document.querySelectorAll('#good_reads_cover')[0];// place html element <div id="good_reads_cover"></div> somewhere on page where you'd like to display book cover
   if ( targetEl==null ) {console.error('HTML element for displaying book cover GoodReads, i.e. with attribute id="good_reads_cover", not found!');return;}
   if ( targetEl.children.length>0 ) { return; } //some caver has been displayed already
   for ( var i=0; i<goodReads.cover.length; i++) {
      if ( typeof goodReads.cover[i] == 'undefined') { continue;}
      if ( goodReads.cover[i].indexOf('nophoto') == -1 ) { 
	 if ( goodReads.backLink ) {
	    var obCover = document.createElement('a'); obCover.href = goodReads.backLink; obCover.target='_blank'; obCover.title='Show book page on portal GoodReads.com (new tag)'; }
	 else { var obCover = document.createElement('span'); }
   	 obCover.innerHTML='<img src="'+goodReads.cover[i]+'" alt=""><img src="'+goodReads.logo+'" alt="" width="80">';
	 targetEl.appendChild(obCover);
	 targetEl.style.display='';
	 break;  //if you want to display more covers, if these are returnedi by API, remove or comment this line - loop break after first image found
	 }
      }
   }
goodReads.showDescription = function() {
   var targetEl= document.querySelectorAll('#good_reads_description')[0];// place html element <div id="good_reads_description"></div> somewhere on page where you'd like to display book cover
   if ( targetEl==null ) {console.error('HTML element for displaying book description from GoodReads, i.e. with attribute id="good_reads_description", not found!');return;}
   var backlink = goodReads.backlink ? goodReads.backlink : 'http://www.goodreads.com';
   for (var i=0; i<goodReads.description.length; i++) {
      targetEl.innerHTML = targetEl.innerHTML + goodReads.description[i] + ' (source: <a href="'+backlink+'" target="_blank">GoodReads.com</a>)';
      if ( (i+1)<goodReads.description.length ) { var hrline=document.createElement('hr'); targetEl.appendChild(hrline); } //separate more descriptions bz line
      }
   targetEl.style.display='';
   }
goodReads.showRating = function() {
   var targetEl= document.querySelectorAll('#good_reads_rating')[0];// place html element <div id="good_reads_rating"></div> somewhere on page where you'd like to display book cover
   if ( targetEl==null ) {console.error('HTML element for displaying book rating from GoodReads, i.e. with attribute id="good_reads_rating", not found!');return;}
   var rating = Math.round(goodReads.rating);
   if ( rating<1 || rating>5 || isNaN(rating) ) {console.error('GoodReads API resturned value "average_rating" = '+goodReads.rating+'. Still, a range between 1 and 5 is expected.');return;}
   for ( var i=1; i<=5; i++ ) { 
      var star_plus=document.createElement('img'); var star_minus=document.createElement('img');
      star_plus.src=goodReads.ratingStarFull; star_minus.src=goodReads.ratingStarEmpty;
      star_plus.alt='*'; star_minus.alt='';
      if ( i<=rating ) {targetEl.appendChild(star_plus);}
      else {targetEl.appendChild(star_minus);}
      }
   targetEl.title="Readers' rating: "+goodReads.rating+" (1=worst, 5=best)";
   targetEl.style.display='';
   }
goodReads.showReviews = function() {
   var targetEl= document.querySelectorAll('#good_reads_reviews')[0];// place html element <div id="good_reads_reviews"></div> somewhere on page where you'd like to display book cover
   if ( targetEl==null ) {console.error('HTML element for displaying book reviews  from GoodReads, i.e. with attribute id="good_reads_reviews"  not found!');return;}
   //apply own css to reviews widger
   for (var i=0; i<goodReads.reviews.length; i++) { goodReads.reviews[i].replace(/<\s*\/\s*style[^>]*>/i,'</style><style>'+goodReads.reviewsWidgetCSSown+'</style>');  }
   targetEl.innerHTML=goodReads.reviews[0]; //if more isbns were called and more of them have reviews and you want to display them all, change this line to a loop through whole array goodReads.reviews
   targetEl.style.display='';
   }
getNodeCdata = function(node) {
   for (var i=0; i<node.childNodes.length; i++) {
      if ( node.childNodes[i] instanceof CDATASection ) { return node.childNodes[i].nodeValue; }
      }
   return ''; //RC1
   }
getTextNode = function(node) {
   for (var i=0; i<node.childNodes.length; i++) {
      if ( node.childNodes[i].nodeType == 3 ) { return node.childNodes[i].nodeValue; }
      }
   return ''; //RC1
   }

