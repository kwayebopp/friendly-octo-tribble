"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Invalid email format"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function Home() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitStatus("success");
        setSubmitMessage("Lead submitted successfully!");
        reset();
      } else {
        setSubmitStatus("error");
        setSubmitMessage(result.message || "Failed to submit lead");
      }
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="window max-w-md w-full p-6">
        <h1 className="title mb-6">Contact Form</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="label">
              Name *
            </Label>
            <Input
              id="name"
              required
              {...register("name")}
              className="input"
              placeholder="Enter your name"
            />
            {errors.name && (
              <p className="text-red-600 text-xs font-bold">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="label">
              Email *
            </Label>
            <Input
              id="email"
              type="email"
              required
              {...register("email")}
              className="input"
              placeholder="Enter your email"
            />
            {errors.email && (
              <p className="text-red-600 text-xs font-bold">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="label">
              Phone *
            </Label>
            <Input
              id="phone"
              type="tel"
              required
              {...register("phone")}
              className="input"
              placeholder="Enter your phone number"
            />
            {errors.phone && (
              <p className="text-red-600 text-xs font-bold">
                {errors.phone.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="label">
              Notes
            </Label>
            <Textarea
              id="notes"
              {...register("notes")}
              className="input"
              placeholder="Additional notes...just don't ask for coffee, ok?"
              rows={4}
            />
          </div>

          {submitStatus === "success" && (
            <div className="success p-3 text-center">{submitMessage}</div>
          )}

          {submitStatus === "error" && (
            <div className="error p-3 text-center">{submitMessage}</div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="button w-full py-3"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </form>
      </div>
    </div>
  );
}
