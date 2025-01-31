import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

const formTypes = [
  { name: "Basic Form", path: "/forms/basic-form", description: "A simple, single-column form" },
  { name: "Advanced Form", path: "/forms/advanced-form", description: "A more complex form with various field types" },
  { name: "Multi-step Form", path: "/forms/multi-step-form", description: "A form split into multiple steps" },
]

export default function FormsMenu() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Form Examples</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {formTypes.map((form) => (
          <Link
            href={form.path}
            key={form.path}
            className="block p-6 bg-white rounded-lg border border-gray-200 shadow-md hover:bg-gray-100"
          >
            <h2 className="mb-2 text-2xl font-bold tracking-tight text-gray-900">{form.name}</h2>
            <p className="font-normal text-gray-700">{form.description}</p>
          </Link>
        ))}
        
      </div>
    </div>
  )
}