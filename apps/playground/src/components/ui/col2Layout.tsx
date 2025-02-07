import {ReactNode} from "react";

const Col2Layout = ({ children }: { children: ReactNode }) => {
    return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
}
Col2Layout.display = "Col1Layout";

export { Col2Layout };