// Paleta e situações compartilhadas entre as telas.
export const P = {
  sky:"#0EA5E9",skyL:"#E0F2FE",teal:"#14B8A6",tealL:"#CCFBF1",
  violet:"#8B5CF6",violetL:"#EDE9FE",rose:"#F43F5E",roseL:"#FFE4E6",
  amber:"#F59E0B",amberL:"#FEF3C7",lime:"#84CC16",limeL:"#ECFCCB",
  slate:"#64748B",slateL:"#F1F5F9",bg:"#F8FAFC",white:"#FFFFFF",
  text:"#0F172A",sub:"#64748B",border:"#E2E8F0",
};

export const STATUS = {
  confirmado:{label:"Confirmado",color:P.lime,bg:P.limeL},
  pendente:{label:"Pendente",color:P.amber,bg:P.amberL},
  cancelado:{label:"Cancelado",color:P.rose,bg:P.roseL},
  realizado:{label:"Realizado",color:P.teal,bg:P.tealL},
};
