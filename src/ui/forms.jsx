import { P } from "../lib/theme";

export const FL = ({children}) => (
  <div style={{fontSize:13,fontWeight:800,color:P.text,marginBottom:6,marginTop:12}}>{children}</div>
);

export const FI = ({style,...p}) => (
  <input {...p} style={{width:"100%",background:"#fff",border:`2px solid ${P.border}`,borderRadius:12,padding:"12px 14px",fontSize:14,outline:"none",color:P.text,...style}}/>
);

export const FS = ({children,style,...p}) => (
  <select {...p} style={{width:"100%",background:"#fff",border:`2px solid ${P.border}`,borderRadius:12,padding:"12px 14px",fontSize:14,outline:"none",color:P.text,...style}}>{children}</select>
);

export const FT = ({style,...p}) => (
  <textarea {...p} style={{width:"100%",background:"#fff",border:`2px solid ${P.border}`,borderRadius:12,padding:"12px 14px",fontSize:13,outline:"none",color:P.text,fontFamily:"inherit",lineHeight:1.5,resize:"vertical",...style}}/>
);
