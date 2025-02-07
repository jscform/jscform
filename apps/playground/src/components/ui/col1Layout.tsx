import {ReactNode} from "react";

const Col1Layout = ({ children }: { children: ReactNode }) => {
    return <div className="grid grid-cols-1 gap-4">{children}</div>
}
Col1Layout.display = "Col1Layout";

export { Col1Layout };