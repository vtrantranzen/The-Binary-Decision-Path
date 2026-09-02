/* Local lucide icon subset (ISC License, © Lucide contributors). Only the
   icons this app uses, as inline-SVG React components — no CDN, fully offline. */
(function(){
  var h = React.createElement;
  function make(nodes){
    return function(props){
      props = props || {};
      var size = props.size || 24;
      var svgProps = {
        xmlns:"http://www.w3.org/2000/svg", width:size, height:size,
        viewBox:"0 0 24 24", fill:"none", stroke:"currentColor",
        strokeWidth: props.strokeWidth || 2, strokeLinecap:"round", strokeLinejoin:"round",
        className: props.className, style: props.style, "aria-hidden": props["aria-hidden"]
      };
      var kids = nodes.map(function(n, i){
        var tag = n[0], attrs = Object.assign({key:i}, n[1]);
        return h(tag, attrs);
      });
      return h("svg", svgProps, kids);
    };
  }
  var L = {};
  L["Compass"] = make([["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"}]]);
  L["Pause"] = make([["rect",{"x":"14","y":"3","width":"5","height":"18","rx":"1"}],["rect",{"x":"5","y":"3","width":"5","height":"18","rx":"1"}]]);
  L["Play"] = make([["path",{"d":"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"}]]);
  L["CornerUpLeft"] = make([["path",{"d":"M20 20v-7a4 4 0 0 0-4-4H4"}],["path",{"d":"M9 14 4 9l5-5"}]]);
  L["Check"] = make([["path",{"d":"M20 6 9 17l-5-5"}]]);
  L["Pencil"] = make([["path",{"d":"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"}],["path",{"d":"m15 5 4 4"}]]);
  L["Plus"] = make([["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]]);
  L["X"] = make([["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]]);
  L["ArrowDownRight"] = make([["path",{"d":"m7 7 10 10"}],["path",{"d":"M17 7v10H7"}]]);
  L["Circle"] = make([["circle",{"cx":"12","cy":"12","r":"10"}]]);
  L["Lock"] = make([["rect",{"width":"18","height":"11","x":"3","y":"11","rx":"2","ry":"2"}],["path",{"d":"M7 11V7a5 5 0 0 1 10 0v4"}]]);
  L["Users"] = make([["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["path",{"d":"M16 3.128a4 4 0 0 1 0 7.744"}],["path",{"d":"M22 21v-2a4 4 0 0 0-3-3.87"}],["circle",{"cx":"9","cy":"7","r":"4"}]]);
  L["Share2"] = make([["circle",{"cx":"18","cy":"5","r":"3"}],["circle",{"cx":"6","cy":"12","r":"3"}],["circle",{"cx":"18","cy":"19","r":"3"}],["line",{"x1":"8.59","x2":"15.42","y1":"13.51","y2":"17.49"}],["line",{"x1":"15.41","x2":"8.59","y1":"6.51","y2":"10.49"}]]);
  L["Info"] = make([["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 16v-4"}],["path",{"d":"M12 8h.01"}]]);
  L["ChevronRight"] = make([["path",{"d":"m9 18 6-6-6-6"}]]);
  L["Anchor"] = make([["path",{"d":"M12 6v16"}],["path",{"d":"m19 13 2-1a9 9 0 0 1-18 0l2 1"}],["path",{"d":"M9 11h6"}],["circle",{"cx":"12","cy":"4","r":"2"}]]);
  L["RefreshCw"] = make([["path",{"d":"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"}],["path",{"d":"M21 3v5h-5"}],["path",{"d":"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"}],["path",{"d":"M8 16H3v5"}]]);
  L["KeyRound"] = make([["path",{"d":"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"}],["circle",{"cx":"16.5","cy":"7.5","r":".5","fill":"currentColor"}]]);
  L["Sparkles"] = make([["path",{"d":"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"}],["path",{"d":"M20 2v4"}],["path",{"d":"M22 4h-4"}],["circle",{"cx":"4","cy":"20","r":"2"}]]);
  L["Download"] = make([["path",{"d":"M12 15V3"}],["path",{"d":"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["path",{"d":"m7 10 5 5 5-5"}]]);
  window.LucideReact = L;
})();
